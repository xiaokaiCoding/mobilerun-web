-- Initialize mobilerun_web database and all tables.
-- Run: mysql -u root -p < sql/init.sql

CREATE DATABASE IF NOT EXISTS mobilerun_web
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mobilerun_web;

-- ─── Devices ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS devices (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    serial      VARCHAR(64)  NOT NULL,
    name        VARCHAR(128) DEFAULT NULL,
    model       VARCHAR(128) DEFAULT NULL,
    platform    VARCHAR(16)  NOT NULL DEFAULT 'android',
    status      VARCHAR(32)  NOT NULL DEFAULT 'offline',
    adb_host    VARCHAR(128) DEFAULT NULL,
    adb_port    INT          NOT NULL DEFAULT 5037,
    last_seen_at DATETIME    DEFAULT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_devices_serial (serial),
    INDEX ix_devices_serial (serial)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── LLM Configs ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS llm_configs (
    id           BIGINT        NOT NULL AUTO_INCREMENT,
    name         VARCHAR(128)  NOT NULL,
    provider     VARCHAR(64)   NOT NULL,
    model_name   VARCHAR(128)  NOT NULL,
    api_key      VARCHAR(512)  NOT NULL,
    base_url     VARCHAR(512)  DEFAULT NULL,
    temperature  DECIMAL(5,2)  NOT NULL DEFAULT 0.20,
    max_tokens   INT           NOT NULL DEFAULT 4096,
    is_active    TINYINT       NOT NULL DEFAULT 0,
    extra_params JSON          DEFAULT NULL,
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Test Cases ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS test_cases (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    name         VARCHAR(256) NOT NULL,
    description  TEXT         DEFAULT NULL,
    goal         TEXT         NOT NULL,
    status       VARCHAR(32)  NOT NULL DEFAULT 'active',
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Executions ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS executions (
    id            BIGINT   NOT NULL AUTO_INCREMENT,
    test_case_id  BIGINT   NOT NULL,
    device_id     BIGINT   NOT NULL,
    llm_config_id BIGINT   DEFAULT NULL,
    status        VARCHAR(32) NOT NULL DEFAULT 'pending',
    goal          TEXT     NOT NULL,
    result        TEXT     DEFAULT NULL,
    steps_taken   INT      NOT NULL DEFAULT 0,
    started_at    DATETIME DEFAULT NULL,
    finished_at   DATETIME DEFAULT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX ix_executions_test_case_id (test_case_id),
    INDEX ix_executions_device_id (device_id),
    INDEX ix_executions_status (status),
    CONSTRAINT fk_executions_test_case
        FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_executions_device
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    CONSTRAINT fk_executions_llm_config
        FOREIGN KEY (llm_config_id) REFERENCES llm_configs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Execution Events ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS execution_events (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    execution_id  BIGINT       NOT NULL,
    event_type    VARCHAR(64)  NOT NULL,
    event_data    JSON         NOT NULL,
    seq_no        INT          NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX ix_execution_events_exec_seq (execution_id, seq_no),
    CONSTRAINT fk_events_execution
        FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
