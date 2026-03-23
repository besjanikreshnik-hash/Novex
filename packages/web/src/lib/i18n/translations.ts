/* ─── i18n Translation Definitions ──────────────────────────────── */

export type Locale = 'en' | 'es' | 'tr' | 'sq' | 'de' | 'fr';

export interface LocaleMeta {
  code: Locale;
  name: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleMeta[] = [
  { code: 'en', name: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'es', name: 'Espa\u00f1ol', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'tr', name: 'T\u00fcrk\u00e7e', flag: '\u{1F1F9}\u{1F1F7}' },
  { code: 'sq', name: 'Shqip', flag: '\u{1F1E6}\u{1F1F1}' },
  { code: 'de', name: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'fr', name: 'Fran\u00e7ais', flag: '\u{1F1EB}\u{1F1F7}' },
];

export const DEFAULT_LOCALE: Locale = 'en';

/* ─── Translation Shape ─────────────────────────────────────────── */

export interface Translation {
  // Nav
  nav_convert: string;
  nav_trade: string;
  nav_markets: string;
  nav_wallet: string;
  nav_history: string;
  nav_portfolio: string;
  nav_earn: string;
  nav_alerts: string;
  nav_settings: string;
  nav_support: string;
  nav_referral: string;
  nav_p2p: string;
  nav_fees: string;
  nav_leaderboard: string;
  nav_futures: string;
  nav_copy_trading: string;
  nav_bots: string;

  // Leaderboard
  leaderboard_title: string;
  leaderboard_subtitle: string;
  leaderboard_rank: string;
  leaderboard_trader: string;
  leaderboard_volume: string;
  leaderboard_trades: string;
  leaderboard_top_pair: string;
  leaderboard_24h: string;
  leaderboard_7d: string;
  leaderboard_30d: string;
  leaderboard_all: string;
  leaderboard_you: string;
  leaderboard_no_data: string;

  // Trade page
  trade_buy: string;
  trade_sell: string;
  trade_limit: string;
  trade_market: string;
  trade_stop: string;
  trade_price: string;
  trade_amount: string;
  trade_total: string;
  trade_available: string;
  trade_place_order: string;
  trade_cancel_order: string;
  trade_order_book: string;
  trade_recent_trades: string;
  trade_open_orders: string;

  // Wallet
  wallet_deposit: string;
  wallet_withdraw: string;
  wallet_available_balance: string;
  wallet_locked: string;
  wallet_total_value: string;
  wallet_hide_small_balances: string;

  // Auth
  auth_login: string;
  auth_register: string;
  auth_email: string;
  auth_password: string;
  auth_sign_in: string;
  auth_sign_up: string;
  auth_sign_out: string;
  auth_forgot_password: string;

  // Common
  common_loading: string;
  common_error: string;
  common_success: string;
  common_confirm: string;
  common_cancel: string;
  common_save: string;
  common_search: string;
  common_filter: string;
  common_export: string;
  common_close: string;
  common_save_changes: string;
  common_saving: string;

  // Settings
  settings_title: string;
  settings_subtitle: string;
  settings_profile: string;
  settings_profile_desc: string;
  settings_security: string;
  settings_security_desc: string;
  settings_preferences: string;
  settings_preferences_desc: string;
  settings_change_password: string;
  settings_enable_2fa: string;
  settings_language: string;
  settings_language_desc: string;
  settings_theme: string;
  settings_email_notifications: string;
  settings_danger_zone: string;
  settings_danger_zone_desc: string;
  settings_delete_account: string;
  settings_first_name: string;
  settings_last_name: string;
  settings_current_password: string;
  settings_new_password: string;
  settings_confirm_password: string;
  settings_update_password: string;
  settings_default_pair: string;
  settings_currency_display: string;
  settings_trade_fills: string;
  settings_deposits: string;
  settings_withdrawals: string;
  settings_two_factor_auth: string;
  settings_active_sessions: string;
  settings_api_keys: string;
}

/* ─── English ────────────────────────────────────────────────────── */

const en: Translation = {
  nav_convert: 'Convert',
  nav_trade: 'Trade',
  nav_markets: 'Markets',
  nav_wallet: 'Wallet',
  nav_history: 'History',
  nav_portfolio: 'Portfolio',
  nav_earn: 'Earn',
  nav_alerts: 'Alerts',
  nav_settings: 'Settings',
  nav_support: 'Support',
  nav_referral: 'Referral',
  nav_p2p: 'P2P',
  nav_fees: 'Fees',
  nav_leaderboard: 'Leaderboard',
  nav_futures: 'Futures',
  nav_copy_trading: 'Copy',
  nav_bots: 'Bots',

  leaderboard_title: 'Trading Leaderboard',
  leaderboard_subtitle: 'Top traders by volume',
  leaderboard_rank: '#',
  leaderboard_trader: 'Trader',
  leaderboard_volume: 'Volume (USDT)',
  leaderboard_trades: 'Trades',
  leaderboard_top_pair: 'Top Pair',
  leaderboard_24h: '24h',
  leaderboard_7d: '7 Days',
  leaderboard_30d: '30 Days',
  leaderboard_all: 'All Time',
  leaderboard_you: 'You',
  leaderboard_no_data: 'No trading data available for this period',

  trade_buy: 'Buy',
  trade_sell: 'Sell',
  trade_limit: 'Limit',
  trade_market: 'Market',
  trade_stop: 'Stop',
  trade_price: 'Price',
  trade_amount: 'Amount',
  trade_total: 'Total',
  trade_available: 'Available',
  trade_place_order: 'Place Order',
  trade_cancel_order: 'Cancel Order',
  trade_order_book: 'Order Book',
  trade_recent_trades: 'Recent Trades',
  trade_open_orders: 'Open Orders',

  wallet_deposit: 'Deposit',
  wallet_withdraw: 'Withdraw',
  wallet_available_balance: 'Available Balance',
  wallet_locked: 'Locked',
  wallet_total_value: 'Total Value',
  wallet_hide_small_balances: 'Hide Small Balances',

  auth_login: 'Log In',
  auth_register: 'Register',
  auth_email: 'Email',
  auth_password: 'Password',
  auth_sign_in: 'Sign In',
  auth_sign_up: 'Sign Up',
  auth_sign_out: 'Sign Out',
  auth_forgot_password: 'Forgot Password',

  common_loading: 'Loading',
  common_error: 'Error',
  common_success: 'Success',
  common_confirm: 'Confirm',
  common_cancel: 'Cancel',
  common_save: 'Save',
  common_search: 'Search',
  common_filter: 'Filter',
  common_export: 'Export',
  common_close: 'Close',
  common_save_changes: 'Save Changes',
  common_saving: 'Saving...',

  settings_title: 'Settings',
  settings_subtitle: 'Manage your account, security, and preferences',
  settings_profile: 'Profile',
  settings_profile_desc: 'Your personal information',
  settings_security: 'Security',
  settings_security_desc: 'Protect your account',
  settings_preferences: 'Preferences',
  settings_preferences_desc: 'Customize your experience',
  settings_change_password: 'Change Password',
  settings_enable_2fa: 'Enable 2FA',
  settings_language: 'Language',
  settings_language_desc: 'Select your preferred language',
  settings_theme: 'Theme',
  settings_email_notifications: 'Email Notifications',
  settings_danger_zone: 'Danger Zone',
  settings_danger_zone_desc: 'Irreversible actions',
  settings_delete_account: 'Delete Account',
  settings_first_name: 'First Name',
  settings_last_name: 'Last Name',
  settings_current_password: 'Current Password',
  settings_new_password: 'New Password',
  settings_confirm_password: 'Confirm New Password',
  settings_update_password: 'Update Password',
  settings_default_pair: 'Default Trading Pair',
  settings_currency_display: 'Currency Display',
  settings_trade_fills: 'Trade fills',
  settings_deposits: 'Deposits',
  settings_withdrawals: 'Withdrawals',
  settings_two_factor_auth: 'Two-Factor Authentication',
  settings_active_sessions: 'Active Sessions',
  settings_api_keys: 'API Key Management',
};

/* ─── Spanish ────────────────────────────────────────────────────── */

const es: Translation = {
  nav_convert: 'Convertir',
  nav_trade: 'Comercio',
  nav_markets: 'Mercados',
  nav_wallet: 'Billetera',
  nav_history: 'Historial',
  nav_portfolio: 'Portafolio',
  nav_earn: 'Ganar',
  nav_alerts: 'Alertas',
  nav_settings: 'Configuraci\u00f3n',
  nav_support: 'Soporte',
  nav_referral: 'Referido',
  nav_p2p: 'P2P',
  nav_fees: 'Comisiones',
  nav_leaderboard: 'Clasificaci\u00f3n',
  nav_futures: 'Futuros',
  nav_copy_trading: 'Copiar',
  nav_bots: 'Bots',

  leaderboard_title: 'Clasificaci\u00f3n de Trading',
  leaderboard_subtitle: 'Mejores traders por volumen',
  leaderboard_rank: '#',
  leaderboard_trader: 'Trader',
  leaderboard_volume: 'Volumen (USDT)',
  leaderboard_trades: 'Operaciones',
  leaderboard_top_pair: 'Par Principal',
  leaderboard_24h: '24h',
  leaderboard_7d: '7 D\u00edas',
  leaderboard_30d: '30 D\u00edas',
  leaderboard_all: 'Todo',
  leaderboard_you: 'T\u00fa',
  leaderboard_no_data: 'No hay datos de trading disponibles para este per\u00edodo',

  trade_buy: 'Comprar',
  trade_sell: 'Vender',
  trade_limit: 'L\u00edmite',
  trade_market: 'Mercado',
  trade_stop: 'Stop',
  trade_price: 'Precio',
  trade_amount: 'Cantidad',
  trade_total: 'Total',
  trade_available: 'Disponible',
  trade_place_order: 'Crear Orden',
  trade_cancel_order: 'Cancelar Orden',
  trade_order_book: 'Libro de \u00d3rdenes',
  trade_recent_trades: 'Operaciones Recientes',
  trade_open_orders: '\u00d3rdenes Abiertas',

  wallet_deposit: 'Depositar',
  wallet_withdraw: 'Retirar',
  wallet_available_balance: 'Saldo Disponible',
  wallet_locked: 'Bloqueado',
  wallet_total_value: 'Valor Total',
  wallet_hide_small_balances: 'Ocultar Saldos Peque\u00f1os',

  auth_login: 'Iniciar Sesi\u00f3n',
  auth_register: 'Registrarse',
  auth_email: 'Correo Electr\u00f3nico',
  auth_password: 'Contrase\u00f1a',
  auth_sign_in: 'Iniciar Sesi\u00f3n',
  auth_sign_up: 'Registrarse',
  auth_sign_out: 'Cerrar Sesi\u00f3n',
  auth_forgot_password: 'Olvidaste tu Contrase\u00f1a',

  common_loading: 'Cargando',
  common_error: 'Error',
  common_success: '\u00c9xito',
  common_confirm: 'Confirmar',
  common_cancel: 'Cancelar',
  common_save: 'Guardar',
  common_search: 'Buscar',
  common_filter: 'Filtrar',
  common_export: 'Exportar',
  common_close: 'Cerrar',
  common_save_changes: 'Guardar Cambios',
  common_saving: 'Guardando...',

  settings_title: 'Configuraci\u00f3n',
  settings_subtitle: 'Administra tu cuenta, seguridad y preferencias',
  settings_profile: 'Perfil',
  settings_profile_desc: 'Tu informaci\u00f3n personal',
  settings_security: 'Seguridad',
  settings_security_desc: 'Protege tu cuenta',
  settings_preferences: 'Preferencias',
  settings_preferences_desc: 'Personaliza tu experiencia',
  settings_change_password: 'Cambiar Contrase\u00f1a',
  settings_enable_2fa: 'Activar 2FA',
  settings_language: 'Idioma',
  settings_language_desc: 'Selecciona tu idioma preferido',
  settings_theme: 'Tema',
  settings_email_notifications: 'Notificaciones por Correo',
  settings_danger_zone: 'Zona de Peligro',
  settings_danger_zone_desc: 'Acciones irreversibles',
  settings_delete_account: 'Eliminar Cuenta',
  settings_first_name: 'Nombre',
  settings_last_name: 'Apellido',
  settings_current_password: 'Contrase\u00f1a Actual',
  settings_new_password: 'Nueva Contrase\u00f1a',
  settings_confirm_password: 'Confirmar Nueva Contrase\u00f1a',
  settings_update_password: 'Actualizar Contrase\u00f1a',
  settings_default_pair: 'Par de Trading Predeterminado',
  settings_currency_display: 'Moneda de Visualizaci\u00f3n',
  settings_trade_fills: 'Ejecuci\u00f3n de \u00f3rdenes',
  settings_deposits: 'Dep\u00f3sitos',
  settings_withdrawals: 'Retiros',
  settings_two_factor_auth: 'Autenticaci\u00f3n de Dos Factores',
  settings_active_sessions: 'Sesiones Activas',
  settings_api_keys: 'Gesti\u00f3n de Claves API',
};

/* ─── Turkish ────────────────────────────────────────────────────── */

const tr: Translation = {
  nav_convert: 'D\u00f6n\u00fc\u015ft\u00fcr',
  nav_trade: 'Al-Sat',
  nav_markets: 'Piyasalar',
  nav_wallet: 'C\u00fczdan',
  nav_history: 'Ge\u00e7mi\u015f',
  nav_portfolio: 'Portf\u00f6y',
  nav_earn: 'Kazan',
  nav_alerts: 'Uyar\u0131lar',
  nav_settings: 'Ayarlar',
  nav_support: 'Destek',
  nav_referral: 'Referans',
  nav_p2p: 'P2P',
  nav_fees: 'Komisyonlar',
  nav_leaderboard: 'Siralama',
  nav_futures: 'Vadeli',
  nav_copy_trading: 'Kopyala',
  nav_bots: 'Botlar',

  leaderboard_title: 'Trading Siralamasi',
  leaderboard_subtitle: 'Hacme gore en iyi traderlar',
  leaderboard_rank: '#',
  leaderboard_trader: 'Trader',
  leaderboard_volume: 'Hacim (USDT)',
  leaderboard_trades: 'Islemler',
  leaderboard_top_pair: 'En Iyi Cift',
  leaderboard_24h: '24s',
  leaderboard_7d: '7 Gun',
  leaderboard_30d: '30 Gun',
  leaderboard_all: 'Tum Zamanlar',
  leaderboard_you: 'Sen',
  leaderboard_no_data: 'Bu donem icin trading verisi yok',

  trade_buy: 'Al',
  trade_sell: 'Sat',
  trade_limit: 'Limit',
  trade_market: 'Piyasa',
  trade_stop: 'Stop',
  trade_price: 'Fiyat',
  trade_amount: 'Miktar',
  trade_total: 'Toplam',
  trade_available: 'Kullan\u0131labilir',
  trade_place_order: 'Emir Ver',
  trade_cancel_order: 'Emri \u0130ptal Et',
  trade_order_book: 'Emir Defteri',
  trade_recent_trades: 'Son \u0130\u015flemler',
  trade_open_orders: 'A\u00e7\u0131k Emirler',

  wallet_deposit: 'Yat\u0131r',
  wallet_withdraw: '\u00c7ek',
  wallet_available_balance: 'Kullan\u0131labilir Bakiye',
  wallet_locked: 'Kilitli',
  wallet_total_value: 'Toplam De\u011fer',
  wallet_hide_small_balances: 'K\u00fc\u00e7\u00fck Bakiyeleri Gizle',

  auth_login: 'Giri\u015f Yap',
  auth_register: 'Kay\u0131t Ol',
  auth_email: 'E-posta',
  auth_password: '\u015eifre',
  auth_sign_in: 'Giri\u015f Yap',
  auth_sign_up: 'Kay\u0131t Ol',
  auth_sign_out: '\u00c7\u0131k\u0131\u015f Yap',
  auth_forgot_password: '\u015eifremi Unuttum',

  common_loading: 'Y\u00fckleniyor',
  common_error: 'Hata',
  common_success: 'Ba\u015far\u0131l\u0131',
  common_confirm: 'Onayla',
  common_cancel: '\u0130ptal',
  common_save: 'Kaydet',
  common_search: 'Ara',
  common_filter: 'Filtrele',
  common_export: 'D\u0131\u015fa Aktar',
  common_close: 'Kapat',
  common_save_changes: 'De\u011fi\u015fiklikleri Kaydet',
  common_saving: 'Kaydediliyor...',

  settings_title: 'Ayarlar',
  settings_subtitle: 'Hesab\u0131n\u0131z\u0131, g\u00fcvenli\u011finizi ve tercihlerinizi y\u00f6netin',
  settings_profile: 'Profil',
  settings_profile_desc: 'Ki\u015fisel bilgileriniz',
  settings_security: 'G\u00fcvenlik',
  settings_security_desc: 'Hesab\u0131n\u0131z\u0131 koruyun',
  settings_preferences: 'Tercihler',
  settings_preferences_desc: 'Deneyiminizi \u00f6zelle\u015ftirin',
  settings_change_password: '\u015eifre De\u011fi\u015ftir',
  settings_enable_2fa: '2FA Etkinle\u015ftir',
  settings_language: 'Dil',
  settings_language_desc: 'Tercih etti\u011finiz dili se\u00e7in',
  settings_theme: 'Tema',
  settings_email_notifications: 'E-posta Bildirimleri',
  settings_danger_zone: 'Tehlikeli B\u00f6lge',
  settings_danger_zone_desc: 'Geri al\u0131namaz i\u015flemler',
  settings_delete_account: 'Hesab\u0131 Sil',
  settings_first_name: 'Ad',
  settings_last_name: 'Soyad',
  settings_current_password: 'Mevcut \u015eifre',
  settings_new_password: 'Yeni \u015eifre',
  settings_confirm_password: 'Yeni \u015eifreyi Onayla',
  settings_update_password: '\u015eifreyi G\u00fcncelle',
  settings_default_pair: 'Varsay\u0131lan \u0130\u015flem \u00c7ifti',
  settings_currency_display: 'Para Birimi G\u00f6sterimi',
  settings_trade_fills: '\u0130\u015flem ger\u00e7ekle\u015fmeleri',
  settings_deposits: 'Yat\u0131r\u0131mlar',
  settings_withdrawals: '\u00c7ekimler',
  settings_two_factor_auth: '\u0130ki Fakt\u00f6rl\u00fc Kimlik Do\u011frulama',
  settings_active_sessions: 'Aktif Oturumlar',
  settings_api_keys: 'API Anahtar Y\u00f6netimi',
};

/* ─── Albanian ───────────────────────────────────────────────────── */

const sq: Translation = {
  nav_convert: 'Konverto',
  nav_trade: 'Tregto',
  nav_markets: 'Tregjet',
  nav_wallet: 'Portofoli',
  nav_history: 'Historiku',
  nav_portfolio: 'Portofoli',
  nav_earn: 'Fito',
  nav_alerts: 'Njoftimet',
  nav_settings: 'Cil\u00ebsimet',
  nav_support: 'Mb\u00ebshtetja',
  nav_referral: 'Referimi',
  nav_p2p: 'P2P',
  nav_fees: 'Tarifat',
  nav_leaderboard: 'Renditja',
  nav_futures: 'Futures',
  nav_copy_trading: 'Kopjo',
  nav_bots: 'Bots',

  leaderboard_title: 'Renditja e Trading',
  leaderboard_subtitle: 'Traderet me te mire sipas volumit',
  leaderboard_rank: '#',
  leaderboard_trader: 'Trader',
  leaderboard_volume: 'Volumi (USDT)',
  leaderboard_trades: 'Tregtite',
  leaderboard_top_pair: 'Cifti Kryesor',
  leaderboard_24h: '24o',
  leaderboard_7d: '7 Dite',
  leaderboard_30d: '30 Dite',
  leaderboard_all: 'Te Gjitha',
  leaderboard_you: 'Ti',
  leaderboard_no_data: 'Nuk ka te dhena tregtie per kete periudhe',

  trade_buy: 'Bli',
  trade_sell: 'Shit',
  trade_limit: 'Limit',
  trade_market: 'Treg',
  trade_stop: 'Stop',
  trade_price: '\u00c7mimi',
  trade_amount: 'Shuma',
  trade_total: 'Totali',
  trade_available: 'N\u00eb Dispozicion',
  trade_place_order: 'Vendos Urdh\u00ebrin',
  trade_cancel_order: 'Anulo Urdh\u00ebrin',
  trade_order_book: 'Libri i Urdh\u00ebrave',
  trade_recent_trades: 'Tregtit\u00eb e Fundit',
  trade_open_orders: 'Urdh\u00ebra t\u00eb Hapura',

  wallet_deposit: 'Deposito',
  wallet_withdraw: 'T\u00ebrheq',
  wallet_available_balance: 'Bilanci i Disponuesh\u00ebm',
  wallet_locked: 'I Bllokuar',
  wallet_total_value: 'Vl\u00ebra Totale',
  wallet_hide_small_balances: 'Fshih Bilancet e Vogla',

  auth_login: 'Hyr',
  auth_register: 'Regjistrohu',
  auth_email: 'Email',
  auth_password: 'Fjal\u00ebkalimi',
  auth_sign_in: 'Hyr',
  auth_sign_up: 'Regjistrohu',
  auth_sign_out: 'Dil',
  auth_forgot_password: 'Keni harruar fjal\u00ebkalimin',

  common_loading: 'Duke ngarkuar',
  common_error: 'Gabim',
  common_success: 'Sukses',
  common_confirm: 'Konfirmo',
  common_cancel: 'Anulo',
  common_save: 'Ruaj',
  common_search: 'K\u00ebrko',
  common_filter: 'Filtro',
  common_export: 'Eksporto',
  common_close: 'Mbyll',
  common_save_changes: 'Ruaj Ndryshimet',
  common_saving: 'Duke ruajtur...',

  settings_title: 'Cil\u00ebsimet',
  settings_subtitle: 'Menaxho llogarin\u00eb, sigurin\u00eb dhe preferencat',
  settings_profile: 'Profili',
  settings_profile_desc: 'Informacioni juaj personal',
  settings_security: 'Siguria',
  settings_security_desc: 'Mbroni llogarin\u00eb tuaj',
  settings_preferences: 'Preferencat',
  settings_preferences_desc: 'Personalizoni p\u00ebrvojin tuaj',
  settings_change_password: 'Ndrysho Fjal\u00ebkalimin',
  settings_enable_2fa: 'Aktivizo 2FA',
  settings_language: 'Gjuha',
  settings_language_desc: 'Zgjidhni gjuh\u00ebn tuaj t\u00eb preferuar',
  settings_theme: 'Tema',
  settings_email_notifications: 'Njoftimet me Email',
  settings_danger_zone: 'Zona e Rrezikshme',
  settings_danger_zone_desc: 'Veprime t\u00eb pakthyeshme',
  settings_delete_account: 'Fshi Llogarin\u00eb',
  settings_first_name: 'Emri',
  settings_last_name: 'Mbiemri',
  settings_current_password: 'Fjal\u00ebkalimi Aktual',
  settings_new_password: 'Fjal\u00ebkalimi i Ri',
  settings_confirm_password: 'Konfirmo Fjal\u00ebkalimin e Ri',
  settings_update_password: 'P\u00ebrdit\u00ebso Fjal\u00ebkalimin',
  settings_default_pair: '\u00c7ifti i Tregtimit t\u00eb Parazgjedhur',
  settings_currency_display: 'Monedha e Shfaqur',
  settings_trade_fills: 'Ekzekutimi i urdh\u00ebrave',
  settings_deposits: 'Depozitat',
  settings_withdrawals: 'T\u00ebrheqjet',
  settings_two_factor_auth: 'Autentifikimi me Dy Faktor\u00eb',
  settings_active_sessions: 'Sesionet Aktive',
  settings_api_keys: 'Menaxhimi i \u00c7el\u00ebsave API',
};

/* ─── German ─────────────────────────────────────────────────────── */

const de: Translation = {
  nav_convert: 'Umwandeln',
  nav_trade: 'Handel',
  nav_markets: 'M\u00e4rkte',
  nav_wallet: 'Wallet',
  nav_history: 'Verlauf',
  nav_portfolio: 'Portfolio',
  nav_earn: 'Verdienen',
  nav_alerts: 'Benachrichtigungen',
  nav_settings: 'Einstellungen',
  nav_support: 'Support',
  nav_referral: 'Empfehlung',
  nav_p2p: 'P2P',
  nav_fees: 'Gebuehren',
  nav_leaderboard: 'Rangliste',
  nav_futures: 'Futures',
  nav_copy_trading: 'Kopieren',
  nav_bots: 'Bots',

  leaderboard_title: 'Trading Rangliste',
  leaderboard_subtitle: 'Top Trader nach Volumen',
  leaderboard_rank: '#',
  leaderboard_trader: 'Trader',
  leaderboard_volume: 'Volumen (USDT)',
  leaderboard_trades: 'Trades',
  leaderboard_top_pair: 'Top Paar',
  leaderboard_24h: '24h',
  leaderboard_7d: '7 Tage',
  leaderboard_30d: '30 Tage',
  leaderboard_all: 'Gesamt',
  leaderboard_you: 'Du',
  leaderboard_no_data: 'Keine Handelsdaten fuer diesen Zeitraum verfuegbar',

  trade_buy: 'Kaufen',
  trade_sell: 'Verkaufen',
  trade_limit: 'Limit',
  trade_market: 'Markt',
  trade_stop: 'Stop',
  trade_price: 'Preis',
  trade_amount: 'Menge',
  trade_total: 'Gesamt',
  trade_available: 'Verf\u00fcgbar',
  trade_place_order: 'Order aufgeben',
  trade_cancel_order: 'Order stornieren',
  trade_order_book: 'Orderbuch',
  trade_recent_trades: 'Letzte Trades',
  trade_open_orders: 'Offene Orders',

  wallet_deposit: 'Einzahlen',
  wallet_withdraw: 'Abheben',
  wallet_available_balance: 'Verf\u00fcgbares Guthaben',
  wallet_locked: 'Gesperrt',
  wallet_total_value: 'Gesamtwert',
  wallet_hide_small_balances: 'Kleine Guthaben ausblenden',

  auth_login: 'Anmelden',
  auth_register: 'Registrieren',
  auth_email: 'E-Mail',
  auth_password: 'Passwort',
  auth_sign_in: 'Anmelden',
  auth_sign_up: 'Registrieren',
  auth_sign_out: 'Abmelden',
  auth_forgot_password: 'Passwort vergessen',

  common_loading: 'Wird geladen',
  common_error: 'Fehler',
  common_success: 'Erfolg',
  common_confirm: 'Best\u00e4tigen',
  common_cancel: 'Abbrechen',
  common_save: 'Speichern',
  common_search: 'Suchen',
  common_filter: 'Filtern',
  common_export: 'Exportieren',
  common_close: 'Schlie\u00dfen',
  common_save_changes: '\u00c4nderungen speichern',
  common_saving: 'Speichern...',

  settings_title: 'Einstellungen',
  settings_subtitle: 'Verwalten Sie Ihr Konto, Sicherheit und Einstellungen',
  settings_profile: 'Profil',
  settings_profile_desc: 'Ihre pers\u00f6nlichen Informationen',
  settings_security: 'Sicherheit',
  settings_security_desc: 'Sch\u00fctzen Sie Ihr Konto',
  settings_preferences: 'Einstellungen',
  settings_preferences_desc: 'Passen Sie Ihre Erfahrung an',
  settings_change_password: 'Passwort \u00e4ndern',
  settings_enable_2fa: '2FA aktivieren',
  settings_language: 'Sprache',
  settings_language_desc: 'W\u00e4hlen Sie Ihre bevorzugte Sprache',
  settings_theme: 'Design',
  settings_email_notifications: 'E-Mail-Benachrichtigungen',
  settings_danger_zone: 'Gefahrenzone',
  settings_danger_zone_desc: 'Unwiderrufliche Aktionen',
  settings_delete_account: 'Konto l\u00f6schen',
  settings_first_name: 'Vorname',
  settings_last_name: 'Nachname',
  settings_current_password: 'Aktuelles Passwort',
  settings_new_password: 'Neues Passwort',
  settings_confirm_password: 'Neues Passwort best\u00e4tigen',
  settings_update_password: 'Passwort aktualisieren',
  settings_default_pair: 'Standard-Handelspaar',
  settings_currency_display: 'W\u00e4hrungsanzeige',
  settings_trade_fills: 'Order-Ausf\u00fchrungen',
  settings_deposits: 'Einzahlungen',
  settings_withdrawals: 'Auszahlungen',
  settings_two_factor_auth: 'Zwei-Faktor-Authentifizierung',
  settings_active_sessions: 'Aktive Sitzungen',
  settings_api_keys: 'API-Schl\u00fcsselverwaltung',
};

/* ─── French ─────────────────────────────────────────────────────── */

const fr: Translation = {
  nav_convert: 'Convertir',
  nav_trade: 'Trading',
  nav_markets: 'March\u00e9s',
  nav_wallet: 'Portefeuille',
  nav_history: 'Historique',
  nav_portfolio: 'Portfolio',
  nav_earn: 'Gagner',
  nav_alerts: 'Alertes',
  nav_settings: 'Param\u00e8tres',
  nav_support: 'Support',
  nav_referral: 'Parrainage',
  nav_p2p: 'P2P',
  nav_fees: 'Frais',
  nav_leaderboard: 'Classement',
  nav_futures: 'Futures',
  nav_copy_trading: 'Copier',
  nav_bots: 'Bots',

  leaderboard_title: 'Classement Trading',
  leaderboard_subtitle: 'Meilleurs traders par volume',
  leaderboard_rank: '#',
  leaderboard_trader: 'Trader',
  leaderboard_volume: 'Volume (USDT)',
  leaderboard_trades: 'Transactions',
  leaderboard_top_pair: 'Paire Principale',
  leaderboard_24h: '24h',
  leaderboard_7d: '7 Jours',
  leaderboard_30d: '30 Jours',
  leaderboard_all: 'Tout',
  leaderboard_you: 'Vous',
  leaderboard_no_data: 'Aucune donnee de trading disponible pour cette periode',

  trade_buy: 'Acheter',
  trade_sell: 'Vendre',
  trade_limit: 'Limite',
  trade_market: 'March\u00e9',
  trade_stop: 'Stop',
  trade_price: 'Prix',
  trade_amount: 'Montant',
  trade_total: 'Total',
  trade_available: 'Disponible',
  trade_place_order: 'Passer un Ordre',
  trade_cancel_order: 'Annuler l\'Ordre',
  trade_order_book: 'Carnet d\'Ordres',
  trade_recent_trades: 'Transactions R\u00e9centes',
  trade_open_orders: 'Ordres Ouverts',

  wallet_deposit: 'D\u00e9p\u00f4t',
  wallet_withdraw: 'Retrait',
  wallet_available_balance: 'Solde Disponible',
  wallet_locked: 'Verrouill\u00e9',
  wallet_total_value: 'Valeur Totale',
  wallet_hide_small_balances: 'Masquer les Petits Soldes',

  auth_login: 'Connexion',
  auth_register: 'Inscription',
  auth_email: 'E-mail',
  auth_password: 'Mot de passe',
  auth_sign_in: 'Se connecter',
  auth_sign_up: 'S\'inscrire',
  auth_sign_out: 'Se d\u00e9connecter',
  auth_forgot_password: 'Mot de passe oubli\u00e9',

  common_loading: 'Chargement',
  common_error: 'Erreur',
  common_success: 'Succ\u00e8s',
  common_confirm: 'Confirmer',
  common_cancel: 'Annuler',
  common_save: 'Enregistrer',
  common_search: 'Rechercher',
  common_filter: 'Filtrer',
  common_export: 'Exporter',
  common_close: 'Fermer',
  common_save_changes: 'Enregistrer les modifications',
  common_saving: 'Enregistrement...',

  settings_title: 'Param\u00e8tres',
  settings_subtitle: 'G\u00e9rez votre compte, la s\u00e9curit\u00e9 et les pr\u00e9f\u00e9rences',
  settings_profile: 'Profil',
  settings_profile_desc: 'Vos informations personnelles',
  settings_security: 'S\u00e9curit\u00e9',
  settings_security_desc: 'Prot\u00e9gez votre compte',
  settings_preferences: 'Pr\u00e9f\u00e9rences',
  settings_preferences_desc: 'Personnalisez votre exp\u00e9rience',
  settings_change_password: 'Changer le mot de passe',
  settings_enable_2fa: 'Activer 2FA',
  settings_language: 'Langue',
  settings_language_desc: 'S\u00e9lectionnez votre langue pr\u00e9f\u00e9r\u00e9e',
  settings_theme: 'Th\u00e8me',
  settings_email_notifications: 'Notifications par e-mail',
  settings_danger_zone: 'Zone Dangereuse',
  settings_danger_zone_desc: 'Actions irr\u00e9versibles',
  settings_delete_account: 'Supprimer le compte',
  settings_first_name: 'Pr\u00e9nom',
  settings_last_name: 'Nom',
  settings_current_password: 'Mot de passe actuel',
  settings_new_password: 'Nouveau mot de passe',
  settings_confirm_password: 'Confirmer le nouveau mot de passe',
  settings_update_password: 'Mettre \u00e0 jour le mot de passe',
  settings_default_pair: 'Paire de Trading par D\u00e9faut',
  settings_currency_display: 'Devise d\'affichage',
  settings_trade_fills: 'Ex\u00e9cutions d\'ordres',
  settings_deposits: 'D\u00e9p\u00f4ts',
  settings_withdrawals: 'Retraits',
  settings_two_factor_auth: 'Authentification \u00e0 Deux Facteurs',
  settings_active_sessions: 'Sessions Actives',
  settings_api_keys: 'Gestion des Cl\u00e9s API',
};

/* ─── Export map ─────────────────────────────────────────────────── */

export const translations: Record<Locale, Translation> = {
  en,
  es,
  tr,
  sq,
  de,
  fr,
};
