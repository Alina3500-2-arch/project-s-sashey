CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, phone VARCHAR(30) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL, full_name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE leads (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  name VARCHAR(300) NULL, company VARCHAR(300) NULL, niche VARCHAR(300) NULL, phone VARCHAR(100) NULL, email VARCHAR(190) NULL,
  messenger VARCHAR(500) NULL, website VARCHAR(500) NULL, city VARCHAR(200) NULL, initial_message TEXT NULL,
  stage VARCHAR(50) NOT NULL DEFAULT 'Новая заявка', deal_type VARCHAR(100) NULL, responsible_id INT UNSIGNED NULL, source VARCHAR(100) NULL,
  utm_source VARCHAR(300) NULL, utm_medium VARCHAR(300) NULL, utm_campaign VARCHAR(300) NULL, utm_content VARCHAR(300) NULL, utm_term VARCHAR(300) NULL,
  landing_url VARCHAR(1000) NULL, amount DECIMAL(14,2) NULL, product VARCHAR(300) NULL, next_action VARCHAR(1000) NULL,
  next_action_date DATE NULL, documents_url VARCHAR(1000) NULL, extra_links TEXT NULL, deleted_at TIMESTAMP NULL,
  CONSTRAINT leads_responsible_fk FOREIGN KEY (responsible_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX leads_stage_idx (stage,deleted_at), INDEX leads_created_idx (created_at), INDEX leads_responsible_idx (responsible_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE comments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, lead_id INT UNSIGNED NOT NULL, user_id INT UNSIGNED NOT NULL, text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT comments_lead_fk FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT comments_user_fk FOREIGN KEY (user_id) REFERENCES users(id), INDEX comments_lead_idx (lead_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE activity (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, lead_id INT UNSIGNED NOT NULL, user_id INT UNSIGNED NULL, type VARCHAR(50) NOT NULL,
  description VARCHAR(1000) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT activity_lead_fk FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT activity_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL, INDEX activity_lead_idx (lead_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE crm_settings (
  setting_key VARCHAR(100) PRIMARY KEY, setting_value LONGTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE emails (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, lead_id INT UNSIGNED NULL,
  account_email VARCHAR(190) NOT NULL, message_uid VARCHAR(190) NOT NULL,
  direction VARCHAR(20) NOT NULL DEFAULT 'incoming', from_email VARCHAR(190) NULL,
  from_name VARCHAR(300) NULL, to_email VARCHAR(190) NULL, subject VARCHAR(500) NULL,
  body MEDIUMTEXT NULL, sent_at DATETIME NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY emails_account_uid (account_email,message_uid), INDEX emails_lead_idx (lead_id,sent_at),
  CONSTRAINT emails_lead_fk FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
