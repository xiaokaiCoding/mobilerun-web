"""LLM configuration — reads/writes mobilerun config.yaml directly."""

import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/llm-config", tags=["llm-config"])

CONFIG_PATHS = [
    Path.home() / ".config" / "droidrun" / "config.yaml",
    Path("/root/.config/droidrun/config.yaml"),
]

DEFAULT_CONFIG = {
    "provider": "OpenAILike",
    "model": "deepseek-v4-pro",
    "base_url": "https://api.deepseek.com",
    "api_key": "",
    "temperature": 0.2,
    "max_tokens": 4096,
}


def _find_config() -> Path | None:
    for p in CONFIG_PATHS:
        if p.exists():
            return p
    return None


@router.get("")
async def get_llm_config() -> dict[str, Any]:
    """Read the current LLM config from config.yaml."""
    path = _find_config()
    if not path:
        return DEFAULT_CONFIG

    try:
        result = subprocess.run(
            ["python3", "-c", f"""
import yaml, json
with open('{path}') as f:
    cfg = yaml.safe_load(f)
profiles = cfg.get('llm_profiles', {{}})
first_key = next(iter(profiles), None)
profile = profiles.get(first_key, {{}}) if first_key else {{}}
kwargs = profile.get('kwargs', {{}})
result = {{
    'provider': profile.get('provider', ''),
    'model': profile.get('model', ''),
    'base_url': profile.get('base_url', '') or profile.get('api_base', ''),
    'api_key': kwargs.get('api_key', ''),
    'temperature': float(profile.get('temperature', 0.2)),
    'max_tokens': int(profile.get('max_tokens', 4096)),
}}
print(json.dumps(result))
"""],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            return json.loads(result.stdout.strip())
    except Exception:
        logger.exception("Failed to read config.yaml")
    return DEFAULT_CONFIG


@router.put("")
async def update_llm_config(payload: dict[str, Any]) -> dict[str, Any]:
    """Update the LLM config in config.yaml."""
    path = _find_config()
    if not path:
        path = Path("/root/.config/droidrun/config.yaml")
        path.parent.mkdir(parents=True, exist_ok=True)

    # Read existing config to get current api_key if not provided
    existing = await get_llm_config()
    api_key = payload.get("api_key", existing.get("api_key", ""))
    if not api_key:
        api_key = existing.get("api_key", "")

    config_data = {
        "provider": payload.get("provider", existing["provider"]),
        "model": payload.get("model", existing["model"]),
        "base_url": payload.get("base_url", existing["base_url"]),
        "temperature": float(payload.get("temperature", existing["temperature"])),
        "max_tokens": int(payload.get("max_tokens", existing["max_tokens"])),
        "api_key": api_key,
    }

    try:
        result = subprocess.run(
            ["python3", "-c", f"""
import yaml, json, os

path = '{path}'
data = json.loads('''{json.dumps(config_data)}''')

if os.path.exists(path):
    with open(path) as f:
        cfg = yaml.safe_load(f) or {{}}
else:
    cfg = {{
        'agent': {{'name': 'mobilerun', 'max_steps': 15}},
        'device': {{'platform': 'android', 'auto_setup': True}},
        'telemetry': {{'enabled': True}},
        'logging': {{'debug': False}},
        'tools': {{}},
        'credentials': {{'enabled': False}},
        'mcp': {{'enabled': False}},
        '_version': 6,
    }}

profiles = cfg.get('llm_profiles', {{}})
for key in profiles:
    profiles[key]['provider'] = data['provider']
    profiles[key]['model'] = data['model']
    profiles[key]['base_url'] = data['base_url']
    profiles[key]['api_base'] = data['base_url']
    profiles[key]['temperature'] = data['temperature']
    profiles[key]['max_tokens'] = data.get('max_tokens', 4096)
    profiles[key]['kwargs'] = {{'api_key': data['api_key']}}

cfg['llm_profiles'] = profiles

with open(path, 'w') as f:
    yaml.dump(cfg, f, default_flow_style=False, allow_unicode=True)

print('OK')
"""],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            return {"status": "ok", **config_data}
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to write config: {result.stderr.decode()}",
            )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to write config.yaml")
        raise HTTPException(status_code=500, detail="Failed to write config file")
