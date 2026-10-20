"""DUNCE_BOT_BTC_MK4.py.

===================
High-Frequency Statistical Directional Call-Out & Execution Engine
Designed for Kalshi 15-Minute Bitcoin (KXBTC15M) Markets.
Includes Automated Microsoft Excel Analytics & Descriptive Statistics Export.
"""

import base64
from collections import deque
import datetime
import json
import logging
import math
import os
import statistics
import threading
import time
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse
import uuid

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ed25519, padding
from cryptography.hazmat.primitives.serialization import load_pem_private_key
import requests

try:
    import openpyxl
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter
    from openpyxl.worksheet.table import Table, TableStyleInfo
    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
CONFIG = {
    # Kalshi API Setup
    "BASE_URL": "https://external-api.kalshi.com/trade-api/v2",
    "API_KEY_ID": "",
    "PRIVATE_KEY_PATH": "",  # Automatically expands ~ on Raspberry Pi / Linux
    "SERIES_TICKER": "KXBTC15M",
    # Operational & Trading Controls
    "DRY_RUN": True,  # True = Paper trade & ping | False = Live Kalshi orders
    "CONTRACTS_PER_TRADE": 5,
    "MAX_ENTRY_PRICE_CENTS": 95,
    "MIN_ENTRY_PRICE_CENTS": 25,
    "LOOP_INTERVAL_SECONDS": 4,
    # --- DIRECTIONAL CALL-OUT RULES (EXACTLY 1 PER CYCLE) ---
    "VOL_LOOKBACK_SECONDS": 300,  # 5-min rolling window for realized volatility
    "MIN_ANNUALIZED_VOL": 0.20,  # 20% volatility baseline
    "EARLY_TRIGGER_Z": 1.00,  # Early breakout trigger threshold
    "FALLBACK_TRIGGER_MINUTES": 1.5,  # Fallback decision window in minutes
    "FINAL_CUTOFF_SECONDS": 30.0,  # Lockout in final 30 seconds
    # Analytics & Excel Export
    "EXCEL_FILE_PATH": "kalshi_btc15m_analytics.xlsx",
    "AUTO_EXPORT_EXCEL": True,
    # Telegram Credentials
    "TELEGRAM_BOT_TOKEN": "8850160301:AAF_6Mth6lmuk8CIyGvvozBQjzYu0c1AfNM",
    "TELEGRAM_CHAT_ID": ,
}

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)


# -----------------------------------------------------------------------------
# Quantitative Core
# -----------------------------------------------------------------------------
def normal_cdf(x: float) -> float:
    """Standard Normal Cumulative Distribution Function."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def calculate_realized_volatility(
    spot_history: deque, min_vol: float = 0.20
) -> float:
    """Computes annualized realized volatility from timestamped spot observations."""
    if len(spot_history) < 5:
        return min_vol
    prices = [p for _, p in spot_history]
    timestamps = [t for t, _ in spot_history]
    total_dt = timestamps[-1] - timestamps[0]
    if total_dt <= 0:
        return min_vol

    log_returns = []
    for i in range(1, len(prices)):
        dt = timestamps[i] - timestamps[i - 1]
        if dt > 0 and prices[i - 1] > 0:
            log_returns.append(math.log(prices[i] / prices[i - 1]))

    if len(log_returns) < 2:
        return min_vol

    mean_ret = sum(log_returns) / len(log_returns)
    variance = sum((r - mean_ret) ** 2 for r in log_returns) / (
        len(log_returns) - 1
    )
    mean_dt = total_dt / len(log_returns)
    annualized_vol = math.sqrt(variance * (31557600.0 / mean_dt))
    return max(annualized_vol, min_vol)


def binary_option_metrics(
    spot: float, strike: float, t_rem_secs: float, ann_vol: float
) -> Tuple[float, float]:
    """Computes Black-Scholes d2 (Z-score) and theoretical win probability of Spot >= Strike."""
    t_years = max(t_rem_secs, 1.0) / 31557600.0
    vol_sqrt_t = ann_vol * math.sqrt(t_years)

    if vol_sqrt_t <= 1e-7:
        z = 10.0 if spot >= strike else -10.0
    else:
        z = (math.log(spot / strike) - 0.5 * (ann_vol**2) * t_years) / vol_sqrt_t

    p_yes = normal_cdf(z)
    return z, p_yes


# -----------------------------------------------------------------------------
# Microsoft Excel Analytics & Descriptive Statistics Exporter
# -----------------------------------------------------------------------------
class ExcelExporter:
    """Exports raw 15-minute market cycles to an auto-sorted Excel table

    and generates summary descriptive statistics and market benchmark
    comparisons.
    """

    @staticmethod
    def compute_percentile(data: List[float], p: float) -> float:
        if not data:
            return 0.0
        sorted_d = sorted(data)
        k = (len(sorted_d) - 1) * p
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return sorted_d[int(k)]
        return sorted_d[f] * (c - k) + sorted_d[c] * (k - f)

    @staticmethod
    def get_desc_stats(data: List[float]) -> Dict[str, float]:
        if not data:
            return {
                "count": 0, "mean": 0.0, "stdev": 0.0, "min": 0.0,
                "q25": 0.0, "median": 0.0, "q75": 0.0, "max": 0.0
            }
        cnt = len(data)
        mean_val = statistics.mean(data)
        std_val = statistics.stdev(data) if cnt > 1 else 0.0
        return {
            "count": cnt,
            "mean": mean_val,
            "stdev": std_val,
            "min": min(data),
            "q25": ExcelExporter.compute_percentile(data, 0.25),
            "median": statistics.median(data),
            "q75": ExcelExporter.compute_percentile(data, 0.75),
            "max": max(data),
        }

    @classmethod
    def export(cls, records: List[Dict], filepath: str) -> bool:
        if not OPENPYXL_AVAILABLE:
            logging.error("openpyxl is not installed. Run 'pip install openpyxl'.")
            return False

        if not records:
            logging.warning("No settled records available to export.")
            return False

        # Auto-sort records chronologically by settlement time
        sorted_records = sorted(
            records,
            key=lambda r: r.get("settle_time", r.get("close_dt_str", "")),
            reverse=False,
        )

        wb = openpyxl.Workbook()

        # Styles
        header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
        sub_header_fill = PatternFill(start_color="595959", end_color="595959", fill_type="solid")
        card_fill = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")
        bold_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        metric_font = Font(name="Calibri", size=11, bold=True)
        thin_border = Border(
            left=Side(style="thin", color="D9D9D9"),
            right=Side(style="thin", color="D9D9D9"),
            top=Side(style="thin", color="D9D9D9"),
            bottom=Side(style="thin", color="D9D9D9"),
        )

        # -------------------------------------------------------------
        # SHEET 1: Raw Cycle Data Table
        # -------------------------------------------------------------
        ws_raw = wb.active
        ws_raw.title = "Cycle_Raw_Data"
        ws_raw.views.sheetView[0].showGridLines = True

        headers = [
            "Call Time (UTC)",
            "Settle Time (UTC)",
            "Market Ticker",
            "Event Ticker",
            "Trigger Reason",
            "Spot At Call",
            "Strike Price",
            "Settlement Spot",
            "Realized Vol",
            "Z-Score",
            "Model Prob %",
            "Call Side",
            "Entry Ask (¢)",
            "Market YES Ask (¢)",
            "Outcome",
            "Net PnL ($)",
            "Strategy Return %",
            "Market Baseline Return %",
            "BTC Spot Move %",
        ]
        ws_raw.append(headers)

        for cell in ws_raw[1]:
            cell.fill = header_fill
            cell.font = bold_font
            cell.alignment = Alignment(horizontal="center", vertical="center")

        for r in sorted_records:
            ws_raw.append([
                r.get("call_time_str", ""),
                r.get("settle_time_str", ""),
                r.get("ticker", ""),
                r.get("event_ticker", ""),
                r.get("trigger_reason", ""),
                r.get("spot_at_call", 0.0),
                r.get("strike", 0.0),
                r.get("settle_spot", 0.0),
                r.get("vol", 0.0),
                r.get("z_score", 0.0),
                r.get("model_prob", 0.0),
                r.get("side", ""),
                r.get("ask_at_call", 0),
                r.get("market_yes_ask", 50),
                r.get("outcome_label", ""),
                r.get("pnl_dollars", 0.0),
                r.get("trade_return_pct", 0.0),
                r.get("market_baseline_return_pct", 0.0),
                r.get("btc_spot_move_pct", 0.0),
            ])

        # Formatting numeric cells in Raw Data sheet
        row_count = len(sorted_records) + 1
        for row in range(2, row_count + 1):
            ws_raw.cell(row=row, column=6).number_format = "$#,##0.00"   # Spot at call
            ws_raw.cell(row=row, column=7).number_format = "$#,##0.00"   # Strike
            ws_raw.cell(row=row, column=8).number_format = "$#,##0.00"   # Settle spot
            ws_raw.cell(row=row, column=9).number_format = "0.0%"        # Vol
            ws_raw.cell(row=row, column=10).number_format = "0.00"       # Z-score
            ws_raw.cell(row=row, column=11).number_format = "0.0%"       # Model prob
            ws_raw.cell(row=row, column=13).number_format = '0"¢"'       # Entry ask
            ws_raw.cell(row=row, column=14).number_format = '0"¢"'       # Market YES ask
            ws_raw.cell(row=row, column=16).number_format = "$#,##0.00"  # PnL
            ws_raw.cell(row=row, column=17).number_format = "+0.00%;-0.00%;0.00%"  # Strat return
            ws_raw.cell(row=row, column=18).number_format = "+0.00%;-0.00%;0.00%"  # Market baseline return
            ws_raw.cell(row=row, column=19).number_format = "+0.00%;-0.00%;0.00%"  # BTC Spot move

        # Add native Excel Table with sorting & filtering enabled
        tab = Table(displayName="RawCycleData", ref=f"A1:{get_column_letter(len(headers))}{row_count}")
        tab.tableStyleInfo = TableStyleInfo(
            name="TableStyleMedium9",
            showFirstColumn=False,
            showLastColumn=False,
            showRowStripes=True,
            showColumnStripes=False,
        )
        ws_raw.add_table(tab)

        # Auto-fit column widths
        for col in ws_raw.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws_raw.column_dimensions[col_letter].width = max(max_len + 3, 12)

        # -------------------------------------------------------------
        # SHEET 2: Summary Analytics & Market Benchmark Comparison
        # -------------------------------------------------------------
        ws_sum = wb.create_sheet(title="Summary_Analytics")
        ws_sum.views.sheetView[0].showGridLines = True

        # Extract series
        trade_returns = [r.get("trade_return_pct", 0.0) for r in sorted_records]
        market_returns = [r.get("market_baseline_return_pct", 0.0) for r in sorted_records]
        btc_moves = [r.get("btc_spot_move_pct", 0.0) for r in sorted_records]
        vols = [r.get("vol", 0.0) for r in sorted_records]
        z_scores = [r.get("z_score", 0.0) for r in sorted_records]
        model_probs = [r.get("model_prob", 0.0) for r in sorted_records]
        ask_prices = [r.get("ask_at_call", 0.0) for r in sorted_records]
        pnls = [r.get("pnl_dollars", 0.0) for r in sorted_records]

        # 1. Benchmark Comparison Table
        ws_sum["A1"] = "BENCHMARK PERFORMANCE COMPARISON"
        ws_sum["A1"].font = Font(name="Calibri", size=13, bold=True, color="1F497D")

        bench_headers = [
            "Metric",
            "DunceBot Strategy",
            "Entire Market Baseline (Naive YES)",
            "Underlying BTC Spot Market",
            "Strategy Outperformance (Alpha)",
        ]
        ws_sum.append([])  # Row 2 blank
        ws_sum.append(bench_headers)  # Row 3
        for col_idx in range(1, len(bench_headers) + 1):
            cell = ws_sum.cell(row=3, column=col_idx)
            cell.fill = header_fill
            cell.font = bold_font
            cell.alignment = Alignment(horizontal="center", vertical="center")

        avg_strat_ret = statistics.mean(trade_returns) if trade_returns else 0.0
        avg_mkt_ret = statistics.mean(market_returns) if market_returns else 0.0
        avg_btc_move = statistics.mean(btc_moves) if btc_moves else 0.0
        alpha_mkt = avg_strat_ret - avg_mkt_ret

        wins = sum(1 for r in sorted_records if r.get("outcome_label") == "WIN")
        losses = sum(1 for r in sorted_records if r.get("outcome_label") == "LOSS")
        total_trades = len(sorted_records)
        strat_win_rate = (wins / total_trades) if total_trades > 0 else 0.0

        mkt_wins = sum(1 for r in sorted_records if r.get("market_yes_won", False))
        mkt_win_rate = (mkt_wins / total_trades) if total_trades > 0 else 0.0

        total_profit = sum(p for p in pnls if p > 0)
        total_loss = abs(sum(p for p in pnls if p < 0))
        profit_factor = (total_profit / total_loss) if total_loss > 0 else (99.9 if total_profit > 0 else 0.0)

        comparison_data = [
            ("Average Return % per Cycle", avg_strat_ret, avg_mkt_ret, avg_btc_move, alpha_mkt),
            ("Win Rate %", strat_win_rate, mkt_win_rate, "N/A", strat_win_rate - mkt_win_rate),
            ("Cumulative Net PnL ($)", sum(pnls), "N/A", "N/A", "N/A"),
            ("Profit Factor", profit_factor, "N/A", "N/A", "N/A"),
            ("Completed Cycles Evaluated", total_trades, total_trades, total_trades, "-"),
        ]

        for row_data in comparison_data:
            ws_sum.append(list(row_data))

        # Format comparison table rows
        comp_start = 4
        comp_end = 4 + len(comparison_data) - 1

        # Format Avg Return % (Row 4)
        ws_sum.cell(row=4, column=2).number_format = "+0.00%;-0.00%;0.00%"
        ws_sum.cell(row=4, column=3).number_format = "+0.00%;-0.00%;0.00%"
        ws_sum.cell(row=4, column=4).number_format = "+0.00%;-0.00%;0.00%"
        ws_sum.cell(row=4, column=5).number_format = "+0.00%;-0.00%;0.00%"

        # Format Win Rate (Row 5)
        ws_sum.cell(row=5, column=2).number_format = "0.0%"
        ws_sum.cell(row=5, column=3).number_format = "0.0%"
        ws_sum.cell(row=5, column=5).number_format = "+0.0%;-0.0%;0.0%"

        # Format Net PnL (Row 6)
        ws_sum.cell(row=6, column=2).number_format = "$#,##0.00"

        # Format Profit Factor (Row 7)
        ws_sum.cell(row=7, column=2).number_format = "0.00"

        # 2. Descriptive Statistics Summary Table
        desc_start_row = comp_end + 3
        ws_sum.cell(row=desc_start_row, column=1, value="DESCRIPTIVE STATISTICS SUMMARY TABLE").font = Font(
            name="Calibri", size=13, bold=True, color="1F497D"
        )

        desc_headers = [
            "Statistic",
            "Trade Return %",
            "Realized Volatility",
            "Model Win Prob",
            "Entry Price (¢)",
            "Z-Score (σ)",
            "Market Baseline Return %",
        ]
        ws_sum.cell(row=desc_start_row + 2, column=1)  # blank line
        desc_hdr_row = desc_start_row + 2
        for col_idx, h in enumerate(desc_headers, 1):
            cell = ws_sum.cell(row=desc_hdr_row, column=col_idx, value=h)
            cell.fill = sub_header_fill
            cell.font = bold_font
            cell.alignment = Alignment(horizontal="center", vertical="center")

        stats_ret = cls.get_desc_stats(trade_returns)
        stats_vol = cls.get_desc_stats(vols)
        stats_prob = cls.get_desc_stats(model_probs)
        stats_ask = cls.get_desc_stats(ask_prices)
        stats_z = cls.get_desc_stats(z_scores)
        stats_mkt = cls.get_desc_stats(market_returns)

        stat_rows = [
            ("Observation Count", "count"),
            ("Mean (Average)", "mean"),
            ("Standard Deviation", "stdev"),
            ("Minimum", "min"),
            ("25th Percentile (Q1)", "q25"),
            ("Median (50th)", "median"),
            ("75th Percentile (Q3)", "q75"),
            ("Maximum", "max"),
        ]

        curr_row = desc_hdr_row + 1
        for label, key in stat_rows:
            ws_sum.append([
                label,
                stats_ret[key],
                stats_vol[key],
                stats_prob[key],
                stats_ask[key],
                stats_z[key],
                stats_mkt[key],
            ])

            # Apply appropriate number formatting
            r = curr_row
            if key == "count":
                for c in range(2, 8):
                    ws_sum.cell(row=r, column=c).number_format = "#,##0"
            else:
                ws_sum.cell(row=r, column=2).number_format = "+0.00%;-0.00%;0.00%"  # Return %
                ws_sum.cell(row=r, column=3).number_format = "0.0%"                 # Vol
                ws_sum.cell(row=r, column=4).number_format = "0.0%"                 # Prob
                ws_sum.cell(row=r, column=5).number_format = '0.0"¢"'               # Ask
                ws_sum.cell(row=r, column=6).number_format = "0.00"                 # Z
                ws_sum.cell(row=r, column=7).number_format = "+0.00%;-0.00%;0.00%"  # Mkt ret
            curr_row += 1

        # Auto-fit column widths for summary sheet
        for col in ws_sum.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws_sum.column_dimensions[col_letter].width = max(max_len + 3, 15)

        wb.save(filepath)
        logging.info(f"Successfully exported Excel analytics report to: {filepath}")
        return True


# -----------------------------------------------------------------------------
# Kalshi API Client
# -----------------------------------------------------------------------------
class KalshiClient:

    def __init__(self, key_id: str, private_key_path: str, base_url: str):
        self.key_id = key_id
        self.base_url = base_url.rstrip("/")
        self.last_error = ""
        self.private_key = None

        expanded_path = os.path.expanduser(private_key_path)
        if expanded_path and os.path.exists(expanded_path):
            with open(expanded_path, "rb") as f:
                self.private_key = load_pem_private_key(f.read(), password=None)
            logging.info(f"Loaded private key from: {expanded_path}")
        else:
            logging.error(f"Private key NOT found at: {expanded_path}")

    def _sign(self, timestamp_ms: str, method: str, path: str) -> str:
        if not self.private_key:
            return ""
        payload = f"{timestamp_ms}{method.upper()}{path}".encode("utf-8")
        if isinstance(self.private_key, ed25519.Ed25519PrivateKey):
            sig = self.private_key.sign(payload)
        else:
            sig = self.private_key.sign(
                payload,
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.DIGEST_LENGTH,
                ),
                hashes.SHA256(),
            )
        return base64.b64encode(sig).decode("utf-8")

    def request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        data: Optional[Dict] = None,
    ) -> requests.Response:
        url = f"{self.base_url}{endpoint}"
        ts = str(int(time.time() * 1000))
        headers = {
            "KALSHI-ACCESS-KEY": self.key_id,
            "KALSHI-ACCESS-TIMESTAMP": ts,
            "KALSHI-ACCESS-SIGNATURE": self._sign(
                ts, method, urlparse(url).path
            ),
            "Content-Type": "application/json",
        }
        return requests.request(
            method, url, headers=headers, params=params, json=data, timeout=8
        )

    def get_open_markets(self, series_ticker: str) -> List[Dict]:
        tickers = (
            [series_ticker, "KXBTCD"]
            if series_ticker == "KXBTC15M"
            else [series_ticker]
        )
        for t in tickers:
            resp = self.request(
                "GET", "/markets", params={"series_ticker": t, "status": "open"}
            )
            if resp.status_code == 200:
                mkts = resp.json().get("markets", [])
                if mkts:
                    return mkts
        return []

    def get_balance(self) -> Optional[float]:
        resp = self.request("GET", "/portfolio/balance")
        if resp.status_code == 200:
            return resp.json().get("balance", 0) / 100.0
        return None

    def place_order(
        self, ticker: str, side: str, count: int, limit_price_cents: int
    ) -> Dict:
        if not self.private_key:
            self.last_error = "Private key is not loaded."
            return {}

        side_clean = side.lower()
        price_val = max(0.01, min(0.99, limit_price_cents / 100.0))
        book_side = "bid" if side_clean == "yes" else "ask"
        normalized_price = (
            price_val if side_clean == "yes" else (1.0 - price_val)
        )

        payload = {
            "ticker": ticker,
            "client_order_id": str(uuid.uuid4()),
            "side": book_side,
            "count": f"{float(count):.2f}",
            "price": f"{normalized_price:.4f}",
            "time_in_force": "good_till_canceled",
            "self_trade_prevention_type": "taker_at_cross",
        }

        resp = self.request("POST", "/portfolio/events/orders", data=payload)
        if resp.status_code in [200, 201]:
            self.last_error = ""
            return resp.json()

        self.last_error = f"HTTP {resp.status_code}: {resp.text}"
        logging.error(f"Kalshi live order rejected: {self.last_error}")
        return {}


# -----------------------------------------------------------------------------
# Pricing & Spot Helpers
# -----------------------------------------------------------------------------
def extract_ask_cents(market: dict, side: str = "yes") -> int:
    side = side.lower()
    if side == "yes":
        if market.get("yes_ask_dollars"):
            return int(round(float(market["yes_ask_dollars"]) * 100))
        if market.get("yes_ask") is not None:
            return int(market["yes_ask"])
    else:
        if market.get("no_ask_dollars"):
            return int(round(float(market["no_ask_dollars"]) * 100))
        if market.get("no_ask") is not None:
            return int(market["no_ask"])
    return 100


def get_spot_btc() -> Optional[float]:
    feeds = [
        (
            "https://api.coinbase.com/v2/prices/BTC-USD/spot",
            lambda r: float(r.json()["data"]["amount"]),
        ),
        (
            "https://api.kraken.com/0/public/Ticker?pair=XBTUSD",
            lambda r: float(
                (
                    r.json().get("result", {}).get("XXBTZUSD")
                    or r.json().get("result", {}).get("XBTUSD")
                )["c"][0]
            ),
        ),
        (
            "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
            lambda r: float(r.json()["price"]),
        ),
    ]
    for url, parser in feeds:
        try:
            res = requests.get(
                url, headers={"User-Agent": "Mozilla/5.0"}, timeout=3
            )
            if res.status_code == 200:
                val = parser(res)
                if val and val > 0:
                    return val
        except Exception:
            continue
    return None


# -----------------------------------------------------------------------------
# Directional Call-Out & Trading Engine with Excel Logging
# -----------------------------------------------------------------------------
class DunceBotTester:

    def __init__(self, client: KalshiClient, cfg: Dict):
        self.client = client
        self.cfg = cfg
        self.is_active = True
        self.last_spot = 0.0
        self.last_vol = cfg["MIN_ANNUALIZED_VOL"]
        self.last_telemetry = "Engine initializing..."

        self.spot_time_history = deque()
        self.signaled_events = set()

        self.sim_balance = 100.00
        self.callout_history = []
        self.pending_settlement = []

        # Load existing history if spreadsheet exists
        self.load_persisted_history()

    def load_persisted_history(self):
        """Loads historical records from disk if Excel file exists."""
        filepath = self.cfg["EXCEL_FILE_PATH"]
        if not os.path.exists(filepath) or not OPENPYXL_AVAILABLE:
            return
        try:
            wb = openpyxl.load_workbook(filepath, data_only=True)
            if "Cycle_Raw_Data" in wb.sheetnames:
                ws = wb["Cycle_Raw_Data"]
                headers = [c.value for c in ws[1]]
                for row in ws.iter_rows(min_row=2, values_only=True):
                    if not row or not row[0]:
                        continue
                    item = {
                        "call_time_str": str(row[0]),
                        "settle_time_str": str(row[1]),
                        "ticker": str(row[2]),
                        "event_ticker": str(row[3]),
                        "trigger_reason": str(row[4]),
                        "spot_at_call": float(row[5] or 0),
                        "strike": float(row[6] or 0),
                        "settle_spot": float(row[7] or 0),
                        "vol": float(row[8] or 0),
                        "z_score": float(row[9] or 0),
                        "model_prob": float(row[10] or 0),
                        "side": str(row[11]),
                        "ask_at_call": int(row[12] or 0),
                        "market_yes_ask": int(row[13] or 50),
                        "outcome_label": str(row[14]),
                        "pnl_dollars": float(row[15] or 0),
                        "trade_return_pct": float(row[16] or 0),
                        "market_baseline_return_pct": float(row[17] or 0),
                        "btc_spot_move_pct": float(row[18] or 0),
                        "market_yes_won": (float(row[7] or 0) >= float(row[6] or 0)),
                    }
                    self.callout_history.append(item)
                    self.signaled_events.add(item["event_ticker"])
                    self.sim_balance += item["pnl_dollars"]
                logging.info(f"Loaded {len(self.callout_history)} historical cycles from {filepath}")
        except Exception as e:
            logging.error(f"Error loading persisted history: {e}")

    def send_telegram(self, text: str):
        if not self.cfg["TELEGRAM_BOT_TOKEN"] or not self.cfg["TELEGRAM_CHAT_ID"]:
            return
        url = f"https://api.telegram.org/bot{self.cfg['TELEGRAM_BOT_TOKEN']}/sendMessage"
        payload = {
            "chat_id": self.cfg["TELEGRAM_CHAT_ID"],
            "text": text,
            "parse_mode": "Markdown",
        }
        try:
            r = requests.post(url, json=payload, timeout=8)
            if r.status_code != 200:
                payload.pop("parse_mode", None)
                requests.post(url, json=payload, timeout=8)
        except Exception as e:
            logging.error(f"Telegram communication error: {e}")

    def send_excel_to_telegram(self):
        """Sends the Excel report as an attachment directly to Telegram."""
        filepath = self.cfg["EXCEL_FILE_PATH"]
        if not os.path.exists(filepath):
            self.send_telegram("⚠️ Excel report does not exist yet. Please wait for a completed cycle.")
            return

        url = f"https://api.telegram.org/bot{self.cfg['TELEGRAM_BOT_TOKEN']}/sendDocument"
        try:
            with open(filepath, "rb") as f:
                res = requests.post(
                    url,
                    data={"chat_id": self.cfg["TELEGRAM_CHAT_ID"], "caption": "📊 *Bitcoin 15M Excel Analytics Report*"},
                    files={"document": (os.path.basename(filepath), f)},
                    timeout=20,
                )
            if res.status_code != 200:
                self.send_telegram(f"⚠️ Failed to send document: HTTP {res.status_code}")
        except Exception as e:
            logging.error(f"Failed to send Excel document to Telegram: {e}")

    def update_spot(self, spot: float, now_ts: float):
        self.spot_time_history.append((now_ts, spot))
        cutoff = now_ts - self.cfg["VOL_LOOKBACK_SECONDS"]
        while self.spot_time_history and self.spot_time_history[0][0] < cutoff:
            self.spot_time_history.popleft()

    def check_settlements(self, spot: float, now_dt: datetime.datetime):
        """Grades completed calls, calculates returns, and exports to Excel."""
        settled_count = 0
        for item in list(self.pending_settlement):
            if now_dt >= item["close_dt"]:
                won = (
                    (spot >= item["strike"])
                    if item["side"] == "YES"
                    else (spot < item["strike"])
                )

                contracts = self.cfg["CONTRACTS_PER_TRADE"]
                ask_cents = item["ask_at_call"]

                if won:
                    pnl_dollars = ((100 - ask_cents) * contracts) / 100.0
                    trade_return_pct = (100.0 - ask_cents) / ask_cents
                    outcome_label = "WIN"
                    status = f"WIN ✅ (+${pnl_dollars:.2f} | +{trade_return_pct * 100:.1f}%)"
                else:
                    pnl_dollars = -((ask_cents * contracts) / 100.0)
                    trade_return_pct = -1.0  # Total loss of premium paid
                    outcome_label = "LOSS"
                    status = f"LOSS ❌ (-${abs(pnl_dollars):.2f} | -100.0%)"

                self.sim_balance += pnl_dollars

                # -------------------------------------------------------------
                # Market Baseline Calculations
                # -------------------------------------------------------------
                # 1. Market baseline return: Naive passive buy-YES at market ask
                market_yes_won = (spot >= item["strike"])
                market_yes_ask = item.get("market_yes_ask", 50)
                if market_yes_won:
                    market_baseline_return = (100.0 - market_yes_ask) / market_yes_ask
                else:
                    market_baseline_return = -1.0

                # 2. Underlying BTC spot % movement over the cycle
                btc_spot_move = (
                    (spot - item["spot_at_call"]) / item["spot_at_call"]
                    if item["spot_at_call"] > 0
                    else 0.0
                )

                record = {
                    "call_time_str": item["call_time"].strftime("%Y-%m-%d %H:%M:%S"),
                    "settle_time_str": now_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    "ticker": item["ticker"],
                    "event_ticker": item["event_ticker"],
                    "trigger_reason": item["trigger_reason"],
                    "spot_at_call": item["spot_at_call"],
                    "strike": item["strike"],
                    "settle_spot": spot,
                    "vol": item["vol"],
                    "z_score": item["z_score"],
                    "model_prob": item["model_prob"],
                    "side": item["side"],
                    "ask_at_call": ask_cents,
                    "market_yes_ask": market_yes_ask,
                    "market_yes_won": market_yes_won,
                    "outcome_label": outcome_label,
                    "pnl_dollars": pnl_dollars,
                    "trade_return_pct": trade_return_pct,
                    "market_baseline_return_pct": market_baseline_return,
                    "btc_spot_move_pct": btc_spot_move,
                }

                self.callout_history.append(record)
                self.pending_settlement.remove(item)
                settled_count += 1

                self.send_telegram(
                    f"🏁 *CYCLE SETTLED: {status}*\n"
                    f"• *Market:* `{item['ticker']}`\n"
                    f"• *Strategy Return:* `{trade_return_pct * 100:+.1f}%`\n"
                    f"• *Entire Market Baseline:* `{market_baseline_return * 100:+.1f}%`\n"
                    f"• *BTC Move:* `{btc_spot_move * 100:+.2f}%`\n"
                    f"• *Strike Target:* `${item['strike']:,.2f}`\n"
                    f"• *Final Settlement Spot:* `${spot:,.2f}`\n"
                    f"• *Virtual Bankroll:* `${self.sim_balance:.2f}`"
                )

        if settled_count > 0 and self.cfg["AUTO_EXPORT_EXCEL"]:
            ExcelExporter.export(self.callout_history, self.cfg["EXCEL_FILE_PATH"])

    def tick(self):
        now_ts = time.time()
        spot = get_spot_btc()
        if spot is None:
            self.last_telemetry = "⚠️ Spot price feeds offline"
            return

        self.last_spot = spot
        self.update_spot(spot, now_ts)
        self.last_vol = calculate_realized_volatility(
            self.spot_time_history, self.cfg["MIN_ANNUALIZED_VOL"]
        )
        now_dt = datetime.datetime.now(datetime.timezone.utc)

        # 1. Settle completed calls
        self.check_settlements(spot, now_dt)

        # 2. Market Scanning
        markets = self.client.get_open_markets(self.cfg["SERIES_TICKER"])
        if not markets:
            self.last_telemetry = "Scanning for open 15m markets..."
            return

        # Find the market closing soonest
        active_market = None
        min_t_rem = 9999.0
        for m in markets:
            close_str = m.get("close_time") or m.get("expiration_time")
            if not close_str:
                continue
            close_dt = datetime.datetime.fromisoformat(
                close_str.replace("Z", "+00:00")
            )
            t_rem = (close_dt - now_dt).total_seconds()
            if self.cfg["FINAL_CUTOFF_SECONDS"] <= t_rem < min_t_rem:
                min_t_rem = t_rem
                active_market = (m, close_dt)

        if not active_market:
            self.last_telemetry = "Waiting for next cycle (Current in <30s lockout)"
            return

        target_market, close_dt = active_market
        event_ticker = target_market.get("event_ticker")

        # STRICT ONE-PING RULE: If this cycle already pinged, stop immediately
        if event_ticker in self.signaled_events:
            t_min = min_t_rem / 60.0
            self.last_telemetry = f"Cycle `{event_ticker}` signaled. Locked for ~{t_min:.1f}m."
            return

        strike_raw = target_market.get("strike_price") or target_market.get("floor_strike")
        if strike_raw is None:
            return
        strike_val = float(strike_raw)

        # Calculate Real-Time Statistical Metrics
        z_score, p_yes_model = binary_option_metrics(
            spot, strike_val, min_t_rem, self.last_vol
        )
        abs_z = abs(z_score)

        yes_ask = extract_ask_cents(target_market, "yes")
        no_ask = extract_ask_cents(target_market, "no")

        if z_score >= 0:
            direction = "YES"
            bias_title = "🟢 CALL: BUY YES (BULLISH)"
            model_prob = p_yes_model
            ask = yes_ask
        else:
            direction = "NO"
            bias_title = "🔴 CALL: BUY NO (BEARISH)"
            model_prob = 1.0 - p_yes_model
            ask = no_ask

        t_rem_min = min_t_rem / 60.0
        self.last_telemetry = f"Eval `{target_market['ticker']}` | Z: {z_score:+.2f}σ | Time: ~{t_rem_min:.1f}m"

        early_trigger = abs_z >= self.cfg["EARLY_TRIGGER_Z"]
        fallback_trigger = min_t_rem <= self.cfg["FALLBACK_TRIGGER_MINUTES"] * 60.0
        within_price_cap = self.cfg["MIN_ENTRY_PRICE_CENTS"] <= ask <= self.cfg["MAX_ENTRY_PRICE_CENTS"]

        if (early_trigger or fallback_trigger) and within_price_cap:
            trigger_reason = (
                f"Early Breakout ({abs_z:.2f}σ ≥ {self.cfg['EARLY_TRIGGER_Z']}σ)"
                if early_trigger
                else f"Fallback Window (~{t_rem_min:.1f}m left)"
            )

            distance = spot - strike_val
            mode_str = "🧪 PAPER TRADE" if self.cfg["DRY_RUN"] else "🚨 LIVE ORDER"

            callout_msg = (
                f"🎯 *BTC 15M DIRECTIONAL SIGNAL* [{mode_str}]\n\n"
                f"👉 *{bias_title}*\n\n"
                f"• *Contract:* `{target_market['ticker']}`\n"
                f"• *BTC Spot:* `${spot:,.2f}`\n"
                f"• *Target Strike:* `${strike_val:,.2f}`\n"
                f"• *Clearance Buffer:* `{'+' if distance >= 0 else ''}${distance:.2f}`\n\n"
                f"📊 *Statistical Factor Engine:*\n"
                f"• *Statistical Z-Score:* `{z_score:+.2f}σ`\n"
                f"• *Realized Vol (Ann.):* `{self.last_vol * 100:.1f}%`\n"
                f"• *Model Win Probability:* `{model_prob * 100:.1f}%`\n"
                f"• *Market Ask:* `{ask}¢`\n"
                f"• *Time Remaining:* `~{t_rem_min:.1f} minutes`\n\n"
                f"📌 *Trigger Mechanism:* {trigger_reason}"
            )
            self.send_telegram(callout_msg)

            if not self.cfg["DRY_RUN"]:
                res = self.client.place_order(
                    target_market["ticker"],
                    direction,
                    self.cfg["CONTRACTS_PER_TRADE"],
                    ask,
                )
                if res and (res.get("order_id") or res.get("order")):
                    oid = res.get("order_id") or res.get("order", {}).get("order_id")
                    self.send_telegram(f"✅ *LIVE KALSHI ORDER FILLED:* `{oid}`")
                else:
                    self.send_telegram(f"❌ *KALSHI REJECTION:*\n`{self.client.last_error}`")

            self.signaled_events.add(event_ticker)
            self.pending_settlement.append({
                "ticker": target_market["ticker"],
                "event_ticker": event_ticker,
                "call_time": now_dt,
                "spot_at_call": spot,
                "side": direction,
                "strike": strike_val,
                "close_dt": close_dt,
                "ask_at_call": ask,
                "market_yes_ask": yes_ask,
                "model_prob": model_prob,
                "vol": self.last_vol,
                "z_score": z_score,
                "trigger_reason": trigger_reason,
            })
            logging.info(f"[SIGNAL FIRED] {target_market['ticker']}: {direction} @ {ask}¢")

    def trading_loop(self):
        while True:
            if self.is_active:
                try:
                    self.tick()
                except Exception as e:
                    logging.error(f"Trading loop error: {e}", exc_info=True)
                    self.last_telemetry = f"⚠️ Loop Error: {type(e).__name__}"
            time.sleep(self.cfg["LOOP_INTERVAL_SECONDS"])


# -----------------------------------------------------------------------------
# Telegram Interactive Command Listener
# -----------------------------------------------------------------------------
def run_telegram_listener(bot: DunceBotTester):
    offset = 0
    token = bot.cfg["TELEGRAM_BOT_TOKEN"]
    allowed = bot.cfg["TELEGRAM_CHAT_ID"]

    if not token or not allowed:
        logging.warning("Telegram credentials missing; command poller inactive.")
        return

    bot.send_telegram(
        "⚡ *DUNCE_BOT_TESTER MK2 Online!*\n"
        "• Excel Auto-Analytics Engine Enabled.\n"
        "• Exact 1-Callout-Per-Cycle Ready.\n"
        "• Send `/export` anytime to receive the Excel report."
    )

    while True:
        try:
            url = f"https://api.telegram.org/bot{token}/getUpdates?offset={offset}&timeout=20"
            res = requests.get(url, timeout=25).json()

            for update in res.get("result", []):
                offset = update["update_id"] + 1
                msg = update.get("message", {})
                chat_id = msg.get("chat", {}).get("id")
                raw_text = msg.get("text", "").strip()

                if chat_id != allowed or not raw_text:
                    continue

                tokens = raw_text.split()
                base_cmd = tokens[0].lstrip("/").split("@")[0].lower()

                if base_cmd in ["status"]:
                    bal = bot.client.get_balance()
                    bal_str = f"${bal:.2f}" if bal is not None else "N/A"
                    bot.send_telegram(
                        f"📊 *DUNCE_BOT Status:*\n"
                        f"• Engine: `{'RUNNING' if bot.is_active else 'PAUSED'}`\n"
                        f"• Mode: `{'DRY RUN (Paper)' if bot.cfg['DRY_RUN'] else 'LIVE TRADING'}`\n"
                        f"• Early Z-Trigger: `{bot.cfg['EARLY_TRIGGER_Z']:.2f}σ`\n"
                        f"• Kalshi Balance: `{bal_str}`\n"
                        f"• BTC Spot: `${bot.last_spot:,.2f}`\n"
                        f"• Realized Vol: `{bot.last_vol * 100:.1f}%`\n"
                        f"• Telemetry: `{bot.last_telemetry}`\n"
                        f"• Active Pending: `{len(bot.pending_settlement)}`\n"
                        f"• Settled Logged: `{len(bot.callout_history)}`"
                    )

                elif base_cmd in ["export", "excel"]:
                    if not bot.callout_history:
                        bot.send_telegram("⚠️ No completed cycles recorded yet to export.")
                    else:
                        success = ExcelExporter.export(bot.callout_history, bot.cfg["EXCEL_FILE_PATH"])
                        if success:
                            bot.send_telegram("📑 *Generating fresh Excel spreadsheet...*")
                            bot.send_excel_to_telegram()
                        else:
                            bot.send_telegram("❌ Failed to generate Excel report.")

                elif base_cmd in ["sim", "record", "stats"]:
                    total = len(bot.callout_history)
                    wins = sum(1 for x in bot.callout_history if x.get("outcome_label") == "WIN")
                    rate = (wins / total * 100.0) if total > 0 else 0.0
                    net_pnl = bot.sim_balance - 100.00
                    pnl_sign = "+" if net_pnl >= 0 else ""

                    strat_rets = [r.get("trade_return_pct", 0.0) for r in bot.callout_history]
                    mkt_rets = [r.get("market_baseline_return_pct", 0.0) for r in bot.callout_history]
                    avg_strat = statistics.mean(strat_rets) * 100.0 if strat_rets else 0.0
                    avg_mkt = statistics.mean(mkt_rets) * 100.0 if mkt_rets else 0.0

                    bot.send_telegram(
                        f"🏆 *Signal Track Record & Market Comparison:*\n"
                        f"• Virtual Bankroll: `${bot.sim_balance:.2f}` (`{pnl_sign}${net_pnl:.2f}`)\n"
                        f"• Record: `{wins}W - {total - wins}L` ({rate:.1f}% Win Rate)\n"
                        f"• *Strategy Avg Return:* `{avg_strat:+.2f}%`\n"
                        f"• *Entire Market Baseline:* `{avg_mkt:+.2f}%`\n"
                        f"• *Net Alpha:* `{avg_strat - avg_mkt:+.2f}%`\n"
                        f"• Settled Cycles: `{total}`\n\n"
                        f"Type `/export` to download the complete Excel file."
                    )

                elif base_cmd in ["setz", "z"]:
                    if len(tokens) >= 2:
                        try:
                            new_z = float(tokens[1])
                            if 0.10 <= new_z <= 3.00:
                                bot.cfg["EARLY_TRIGGER_Z"] = new_z
                                win_pct = normal_cdf(new_z) * 100.0
                                bot.send_telegram(
                                    f"⚙️ *Risk Parameter Updated!*\n"
                                    f"• *EARLY_TRIGGER_Z:* `{new_z:.2f}σ`\n"
                                    f"• *Target Win Probability:* `~{win_pct:.1f}%`"
                                )
                            else:
                                bot.send_telegram("⚠️ Please pick a number between `0.10` and `3.00`.")
                        except ValueError:
                            bot.send_telegram("⚠️ Invalid format. Example: `/setz 0.67`")
                    else:
                        current_z = bot.cfg["EARLY_TRIGGER_Z"]
                        win_pct = normal_cdf(current_z) * 100.0
                        bot.send_telegram(
                            f"⚙️ *Current Early Trigger:* `{current_z:.2f}σ` (~{win_pct:.1f}%)\n"
                            f"To change, send: `/setz 0.67`"
                        )

                elif base_cmd in ["dryrun"]:
                    bot.cfg["DRY_RUN"] = not bot.cfg["DRY_RUN"]
                    state = "DRY RUN (Paper Trading)" if bot.cfg["DRY_RUN"] else "LIVE REAL TRADING"
                    bot.send_telegram(f"⚙️ Mode switched to: *{state}*")

                elif base_cmd in ["spot"]:
                    bot.send_telegram(f"🪙 *BTC Spot:* `${bot.last_spot:,.2f}`")

                elif base_cmd in ["pause"]:
                    bot.is_active = False
                    bot.send_telegram("⏸️ Bot Execution *PAUSED*.")

                elif base_cmd in ["resume"]:
                    bot.is_active = True
                    bot.send_telegram("▶️ Bot Execution *RESUMED*.")

        except Exception as e:
            logging.error(f"Telegram polling error: {e}")
            time.sleep(3)


# -----------------------------------------------------------------------------
# Main Entry Point
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    client = KalshiClient(
        key_id=CONFIG["API_KEY_ID"],
        private_key_path=CONFIG["PRIVATE_KEY_PATH"],
        base_url=CONFIG["BASE_URL"],
    )

    bot = DunceBotTester(client, CONFIG)
    trading_thread = threading.Thread(target=bot.trading_loop, daemon=True)
    trading_thread.start()

    run_telegram_listener(bot)