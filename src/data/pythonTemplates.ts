/**
 * Python template source files for DunceBot BTC, SOL, and XRP 15-Minute engines.
 * Secrets are stripped/empty in template files and securely loaded from local environment variables.
 */

import { UserSecrets } from '../types/bot';

export const BTC_RAW_TEMPLATE = `"""
DUNCE_BOT_BTC_MK4.py
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

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# -----------------------------------------------------------------------------
# Configuration (Secrets left empty in template; loaded from local .env)
# -----------------------------------------------------------------------------
CONFIG = {
    # Kalshi API Setup
    "BASE_URL": os.getenv("KALSHI_BASE_URL", "https://external-api.kalshi.com/trade-api/v2"),
    "API_KEY_ID": os.getenv("KALSHI_API_KEY_ID", ""),
    "PRIVATE_KEY_PATH": os.getenv("KALSHI_PRIVATE_KEY_PATH", "kalshi_private_key.txt"),
    "SERIES_TICKER": "KXBTC15M",
    # Operational & Trading Controls
    "DRY_RUN": os.getenv("DRY_RUN", "True").lower() in ("true", "1", "yes"),
    "CONTRACTS_PER_TRADE": int(os.getenv("CONTRACTS_PER_TRADE", 5)),
    "MAX_ENTRY_PRICE_CENTS": int(os.getenv("MAX_ENTRY_PRICE_CENTS", 95)),
    "MIN_ENTRY_PRICE_CENTS": int(os.getenv("MIN_ENTRY_PRICE_CENTS", 25)),
    "LOOP_INTERVAL_SECONDS": 4,
    # --- DIRECTIONAL CALL-OUT RULES (EXACTLY 1 PER CYCLE) ---
    "VOL_LOOKBACK_SECONDS": 300,
    "MIN_ANNUALIZED_VOL": 0.20,
    "EARLY_TRIGGER_Z": float(os.getenv("EARLY_TRIGGER_Z", 1.00)),
    "FALLBACK_TRIGGER_MINUTES": 1.5,
    "FINAL_CUTOFF_SECONDS": 30.0,
    # Analytics & Excel Export
    "EXCEL_FILE_PATH": "kalshi_btc15m_analytics.xlsx",
    "AUTO_EXPORT_EXCEL": True,
    # Telegram Credentials
    "TELEGRAM_BOT_TOKEN": os.getenv("TELEGRAM_BOT_TOKEN", ""),
    "TELEGRAM_CHAT_ID": int(os.getenv("TELEGRAM_CHAT_ID", "0")) if os.getenv("TELEGRAM_CHAT_ID", "0").isdigit() else 0,
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
`;

export const SOL_RAW_TEMPLATE = `"""
DUNCE_BOT_SOL15M.py
===================
High-Frequency Statistical Directional Call-Out & Execution Engine
Designed specifically for Kalshi 15-Minute Solana (KXSOL15M) Markets.
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

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# -----------------------------------------------------------------------------
# Configuration (Secrets left empty in template; loaded from local .env)
# -----------------------------------------------------------------------------
CONFIG = {
    # Kalshi API Setup
    "BASE_URL": os.getenv("KALSHI_BASE_URL", "https://external-api.kalshi.com/trade-api/v2"),
    "API_KEY_ID": os.getenv("KALSHI_API_KEY_ID", ""),
    "PRIVATE_KEY_PATH": os.getenv("KALSHI_PRIVATE_KEY_PATH", "kalshi_private_key.txt"),
    "SERIES_TICKER": "KXSOL15M",
    # Operational & Trading Controls
    "DRY_RUN": os.getenv("DRY_RUN", "True").lower() in ("true", "1", "yes"),
    "CONTRACTS_PER_TRADE": int(os.getenv("CONTRACTS_PER_TRADE", 5)),
    "MAX_ENTRY_PRICE_CENTS": int(os.getenv("MAX_ENTRY_PRICE_CENTS", 95)),
    "MIN_ENTRY_PRICE_CENTS": int(os.getenv("MIN_ENTRY_PRICE_CENTS", 25)),
    "LOOP_INTERVAL_SECONDS": 4,
    # --- DIRECTIONAL CALL-OUT RULES (EXACTLY 1 PER CYCLE) ---
    "VOL_LOOKBACK_SECONDS": 300,
    "MIN_ANNUALIZED_VOL": 0.45,
    "EARLY_TRIGGER_Z": float(os.getenv("EARLY_TRIGGER_Z", 1.00)),
    "FALLBACK_TRIGGER_MINUTES": 1.5,
    "FINAL_CUTOFF_SECONDS": 30.0,
    # Analytics & Excel Export
    "EXCEL_FILE_PATH": "kalshi_sol15m_analytics.xlsx",
    "AUTO_EXPORT_EXCEL": True,
    # Telegram Credentials
    "TELEGRAM_BOT_TOKEN": os.getenv("TELEGRAM_BOT_TOKEN", ""),
    "TELEGRAM_CHAT_ID": int(os.getenv("TELEGRAM_CHAT_ID", "0")) if os.getenv("TELEGRAM_CHAT_ID", "0").isdigit() else 0,
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
`;

export const XRP_RAW_TEMPLATE = `"""
DUNCE_BOT_XRP15M.py
===================
High-Frequency Statistical Directional Call-Out & Execution Engine
Designed specifically for Kalshi 15-Minute XRP (KXXRP15M) Markets.
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

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# -----------------------------------------------------------------------------
# Configuration (Secrets left empty in template; loaded from local .env)
# -----------------------------------------------------------------------------
CONFIG = {
    # Kalshi API Setup
    "BASE_URL": os.getenv("KALSHI_BASE_URL", "https://external-api.kalshi.com/trade-api/v2"),
    "API_KEY_ID": os.getenv("KALSHI_API_KEY_ID", ""),
    "PRIVATE_KEY_PATH": os.getenv("KALSHI_PRIVATE_KEY_PATH", "kalshi_private_key.txt"),
    "SERIES_TICKER": "KXXRP15M",
    # Operational & Trading Controls
    "DRY_RUN": os.getenv("DRY_RUN", "True").lower() in ("true", "1", "yes"),
    "CONTRACTS_PER_TRADE": int(os.getenv("CONTRACTS_PER_TRADE", 5)),
    "MAX_ENTRY_PRICE_CENTS": int(os.getenv("MAX_ENTRY_PRICE_CENTS", 95)),
    "MIN_ENTRY_PRICE_CENTS": int(os.getenv("MIN_ENTRY_PRICE_CENTS", 25)),
    "LOOP_INTERVAL_SECONDS": 4,
    # --- DIRECTIONAL CALL-OUT RULES (EXACTLY 1 PER CYCLE) ---
    "VOL_LOOKBACK_SECONDS": 300,
    "MIN_ANNUALIZED_VOL": 0.50,
    "EARLY_TRIGGER_Z": float(os.getenv("EARLY_TRIGGER_Z", 1.00)),
    "FALLBACK_TRIGGER_MINUTES": 1.5,
    "FINAL_CUTOFF_SECONDS": 30.0,
    # Analytics & Excel Export
    "EXCEL_FILE_PATH": "kalshi_xrp15m_analytics.xlsx",
    "AUTO_EXPORT_EXCEL": True,
    # Telegram Credentials
    "TELEGRAM_BOT_TOKEN": os.getenv("TELEGRAM_BOT_TOKEN", ""),
    "TELEGRAM_CHAT_ID": int(os.getenv("TELEGRAM_CHAT_ID", "0")) if os.getenv("TELEGRAM_CHAT_ID", "0").isdigit() else 0,
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
`;

export function getCompleteBotPythonCode(
  asset: 'BTC' | 'SOL' | 'XRP',
  secrets?: UserSecrets,
  injectHardcoded: boolean = false
): string {
  const assetName = asset === 'BTC' ? 'Bitcoin' : asset === 'SOL' ? 'Solana' : 'XRP';
  const ticker = asset === 'BTC' ? 'KXBTC15M' : asset === 'SOL' ? 'KXSOL15M' : 'KXXRP15M';
  const minVol = asset === 'BTC' ? '0.20' : asset === 'SOL' ? '0.45' : '0.50';
  const spotFunc = asset === 'BTC' ? 'get_spot_btc' : asset === 'SOL' ? 'get_spot_sol' : 'get_spot_xrp';
  const excelFile = `kalshi_${asset.toLowerCase()}15m_analytics.xlsx`;

  const configSection = injectHardcoded && secrets
    ? `CONFIG = {
    # Kalshi API Setup (Direct User Injected)
    "BASE_URL": "${secrets.kalshiBaseUrl || 'https://external-api.kalshi.com/trade-api/v2'}",
    "API_KEY_ID": "${secrets.kalshiKeyId || ''}",
    "PRIVATE_KEY_PATH": "${secrets.kalshiPrivateKeyFileName || 'kalshi_private_key.txt'}",
    "SERIES_TICKER": "${ticker}",
    # Operational & Trading Controls
    "DRY_RUN": True,
    "CONTRACTS_PER_TRADE": 5,
    "MAX_ENTRY_PRICE_CENTS": 95,
    "MIN_ENTRY_PRICE_CENTS": 25,
    "LOOP_INTERVAL_SECONDS": 4,
    # --- DIRECTIONAL CALL-OUT RULES (EXACTLY 1 PER CYCLE) ---
    "VOL_LOOKBACK_SECONDS": 300,
    "MIN_ANNUALIZED_VOL": ${minVol},
    "EARLY_TRIGGER_Z": 1.00,
    "FALLBACK_TRIGGER_MINUTES": 1.5,
    "FINAL_CUTOFF_SECONDS": 30.0,
    # Analytics & Excel Export
    "EXCEL_FILE_PATH": "${excelFile}",
    "AUTO_EXPORT_EXCEL": True,
    # Telegram Credentials
    "TELEGRAM_BOT_TOKEN": "${secrets.telegramBotToken || ''}",
    "TELEGRAM_CHAT_ID": ${secrets.telegramChatId || '0'},
}`
    : `CONFIG = {
    # Kalshi API Setup (Template with os.getenv; left empty by default)
    "BASE_URL": os.getenv("KALSHI_BASE_URL", "https://external-api.kalshi.com/trade-api/v2"),
    "API_KEY_ID": os.getenv("KALSHI_API_KEY_ID", ""),
    "PRIVATE_KEY_PATH": os.getenv("KALSHI_PRIVATE_KEY_PATH", "${secrets?.kalshiPrivateKeyFileName || 'kalshi_private_key.txt'}"),
    "SERIES_TICKER": "${ticker}",
    # Operational & Trading Controls
    "DRY_RUN": os.getenv("DRY_RUN", "True").lower() in ("true", "1", "yes"),
    "CONTRACTS_PER_TRADE": int(os.getenv("CONTRACTS_PER_TRADE", 5)),
    "MAX_ENTRY_PRICE_CENTS": int(os.getenv("MAX_ENTRY_PRICE_CENTS", 95)),
    "MIN_ENTRY_PRICE_CENTS": int(os.getenv("MIN_ENTRY_PRICE_CENTS", 25)),
    "LOOP_INTERVAL_SECONDS": int(os.getenv("LOOP_INTERVAL_SECONDS", 4)),
    # --- DIRECTIONAL CALL-OUT RULES (EXACTLY 1 PER CYCLE) ---
    "VOL_LOOKBACK_SECONDS": 300,
    "MIN_ANNUALIZED_VOL": ${minVol},
    "EARLY_TRIGGER_Z": float(os.getenv("EARLY_TRIGGER_Z", 1.00)),
    "FALLBACK_TRIGGER_MINUTES": 1.5,
    "FINAL_CUTOFF_SECONDS": 30.0,
    # Analytics & Excel Export
    "EXCEL_FILE_PATH": "${excelFile}",
    "AUTO_EXPORT_EXCEL": True,
    # Telegram Credentials
    "TELEGRAM_BOT_TOKEN": os.getenv("TELEGRAM_BOT_TOKEN", ""),
    "TELEGRAM_CHAT_ID": int(os.getenv("TELEGRAM_CHAT_ID", "0")) if os.getenv("TELEGRAM_CHAT_ID", "0").isdigit() else 0,
}`;

  return `"""
DUNCE_BOT_${asset}15M.py
===================
High-Frequency Statistical Directional Call-Out & Execution Engine
Designed specifically for Kalshi 15-Minute ${assetName} (${ticker}) Markets.
Includes Automated Microsoft Excel Analytics & Descriptive Statistics Export.
Template File: Secrets stored in local environment variables (.env).
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

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
${configSection}

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# -----------------------------------------------------------------------------
# Quantitative Core
# -----------------------------------------------------------------------------
def normal_cdf(x: float) -> float:
    """Standard Normal Cumulative Distribution Function."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))

def calculate_realized_volatility(spot_history: deque, min_vol: float = ${minVol}) -> float:
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
    variance = sum((r - mean_ret) ** 2 for r in log_returns) / (len(log_returns) - 1)
    mean_dt = total_dt / len(log_returns)
    annualized_vol = math.sqrt(variance * (31557600.0 / mean_dt))
    return max(annualized_vol, min_vol)

def binary_option_metrics(spot: float, strike: float, t_rem_secs: float, ann_vol: float) -> Tuple[float, float]:
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
                padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.DIGEST_LENGTH),
                hashes.SHA256(),
            )
        return base64.b64encode(sig).decode("utf-8")

    def request(self, method: str, endpoint: str, params: Optional[Dict] = None, data: Optional[Dict] = None) -> requests.Response:
        url = f"{self.base_url}{endpoint}"
        ts = str(int(time.time() * 1000))
        headers = {
            "KALSHI-ACCESS-KEY": self.key_id,
            "KALSHI-ACCESS-TIMESTAMP": ts,
            "KALSHI-ACCESS-SIGNATURE": self._sign(ts, method, urlparse(url).path),
            "Content-Type": "application/json",
        }
        return requests.request(method, url, headers=headers, params=params, json=data, timeout=8)

    def get_open_markets(self, series_ticker: str) -> List[Dict]:
        resp = self.request("GET", "/markets", params={"series_ticker": series_ticker, "status": "open"})
        if resp.status_code == 200:
            return resp.json().get("markets", [])
        return []

    def get_balance(self) -> Optional[float]:
        resp = self.request("GET", "/portfolio/balance")
        if resp.status_code == 200:
            return resp.json().get("balance", 0) / 100.0
        return None

    def place_order(self, ticker: str, side: str, count: int, limit_price_cents: int) -> Dict:
        if not self.private_key:
            self.last_error = "Private key is not loaded."
            return {}
        side_clean = side.lower()
        price_val = max(0.01, min(0.99, limit_price_cents / 100.0))
        book_side = "bid" if side_clean == "yes" else "ask"
        normalized_price = price_val if side_clean == "yes" else (1.0 - price_val)

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
        return {}
`;
}
