/**
 * Auto-Categorization Engine
 *
 * Priority order:
 * 1. Merchant rules (from DB) — exact/substring match, highest priority
 * 2. Sign-based routing — positive amounts checked against income keywords first
 * 3. Keyword map — 300+ patterns covering common US bank transaction descriptions
 * 4. Default: "Uncategorized"
 */

// ─── Keyword Map ─────────────────────────────────────────────────────────────
// Each entry is [pattern, category]. Patterns are checked case-insensitively
// against the full description. Earlier entries win on a match.

const KEYWORD_MAP: [string, string][] = [
  // ── Income ─────────────────────────────────────────────────────────────────
  ['PAYROLL', 'Income'],
  ['DIRECT DEP', 'Income'],
  ['DIRECT DEPOSIT', 'Income'],
  ['SALARY', 'Income'],
  ['WAGES', 'Income'],
  ['ACH CREDIT', 'Income'],
  ['EMPLOYER', 'Income'],
  ['GUSTO', 'Income'],
  ['ADP', 'Income'],
  ['PAYCHEX', 'Income'],
  ['INTUIT PAYROLL', 'Income'],
  ['VENMO CASHOUT', 'Income'],
  ['CASH APP CASHOUT', 'Income'],
  ['ZELLE CREDIT', 'Income'],
  ['TAX REFUND', 'Income'],
  ['IRS TREAS', 'Income'],
  ['STATE TAX REFUND', 'Income'],
  ['DIVIDEND', 'Income'],
  ['INTEREST CREDIT', 'Income'],
  ['INTEREST EARNED', 'Income'],
  ['FREELANCE', 'Income'],
  ['CONSULTING FEE', 'Income'],
  ['STRIPE PAYOUT', 'Income'],
  ['PAYPAL TRANSFER', 'Income'],
  ['SQUARE PAYOUT', 'Income'],

  // ── Transfers ──────────────────────────────────────────────────────────────
  ['TRANSFER TO', 'Transfer'],
  ['TRANSFER FROM', 'Transfer'],
  ['ONLINE TRANSFER', 'Transfer'],
  ['WIRE TRANSFER', 'Transfer'],
  ['ACH TRANSFER', 'Transfer'],
  ['ZELLE', 'Transfer'],
  ['VENMO', 'Transfer'],
  ['CASH APP', 'Transfer'],
  ['PAYPAL', 'Transfer'],
  ['APPLE CASH', 'Transfer'],
  ['GOOGLE PAY TRANSFER', 'Transfer'],
  ['BANK TRANSFER', 'Transfer'],
  ['INTERNAL TRANSFER', 'Transfer'],

  // ── Debt Payments ─────────────────────────────────────────────────────────
  ['CREDIT CARD PAYMENT', 'Debt Payment'],
  ['LOAN PAYMENT', 'Debt Payment'],
  ['MORTGAGE PAYMENT', 'Debt Payment'],
  ['AUTO LOAN', 'Debt Payment'],
  ['STUDENT LOAN', 'Debt Payment'],
  ['SALLIE MAE', 'Debt Payment'],
  ['NAVIENT', 'Debt Payment'],
  ['NELNET', 'Debt Payment'],
  ['SOFI LOAN', 'Debt Payment'],
  ['CHASE AUTOPAY', 'Debt Payment'],
  ['CITI AUTOPAY', 'Debt Payment'],
  ['AMEX AUTOPAY', 'Debt Payment'],
  ['DISCOVER AUTOPAY', 'Debt Payment'],
  ['CAPITAL ONE PAYMENT', 'Debt Payment'],
  ['BANK OF AMERICA PAYMENT', 'Debt Payment'],

  // ── Groceries ─────────────────────────────────────────────────────────────
  ['WALMART', 'Groceries'],
  ['WAL-MART', 'Groceries'],
  ['KROGER', 'Groceries'],
  ['SAFEWAY', 'Groceries'],
  ['TRADER JOE', 'Groceries'],
  ['WHOLE FOODS', 'Groceries'],
  ['AMAZON FRESH', 'Groceries'],
  ['COSTCO', 'Groceries'],
  ['SAM\'S CLUB', 'Groceries'],
  ['PUBLIX', 'Groceries'],
  ['ALDI', 'Groceries'],
  ['WINCO', 'Groceries'],
  ['HEB', 'Groceries'],
  ['MEIJER', 'Groceries'],
  ['TARGET GROCERY', 'Groceries'],
  ['SPROUTS', 'Groceries'],
  ['FRESH MARKET', 'Groceries'],
  ['FOOD LION', 'Groceries'],
  ['STOP AND SHOP', 'Groceries'],
  ['WEGMANS', 'Groceries'],
  ['GIANT FOOD', 'Groceries'],
  ['VONS', 'Groceries'],
  ['RALPHS', 'Groceries'],
  ['SMITH\'S FOOD', 'Groceries'],
  ['KING SOOPERS', 'Groceries'],
  ['FRED MEYER', 'Groceries'],
  ['QFC', 'Groceries'],
  ['HARRIS TEETER', 'Groceries'],
  ['INSTACART', 'Groceries'],
  ['SHIPT', 'Groceries'],

  // ── Dining / Restaurants ──────────────────────────────────────────────────
  ['MCDONALD', 'Dining'],
  ['MCDONALDS', 'Dining'],
  ['BURGER KING', 'Dining'],
  ['WENDY', 'Dining'],
  ['TACO BELL', 'Dining'],
  ['CHICK-FIL-A', 'Dining'],
  ['CHICKFILA', 'Dining'],
  ['CHIPOTLE', 'Dining'],
  ['SUBWAY', 'Dining'],
  ['DOMINO', 'Dining'],
  ['PIZZA HUT', 'Dining'],
  ['PAPA JOHN', 'Dining'],
  ['FIVE GUYS', 'Dining'],
  ['IN-N-OUT', 'Dining'],
  ['WHATABURGER', 'Dining'],
  ['SHAKE SHACK', 'Dining'],
  ['PANERA', 'Dining'],
  ['JASON\'S DELI', 'Dining'],
  ['OLIVE GARDEN', 'Dining'],
  ['APPLEBEE', 'Dining'],
  ['CHILI\'S', 'Dining'],
  ['IHOP', 'Dining'],
  ['DENNY\'S', 'Dining'],
  ['WAFFLE HOUSE', 'Dining'],
  ['CRACKER BARREL', 'Dining'],
  ['RED LOBSTER', 'Dining'],
  ['OUTBACK', 'Dining'],
  ['TEXAS ROADHOUSE', 'Dining'],
  ['LONGHORN', 'Dining'],
  ['BUFFALO WILD WINGS', 'Dining'],
  ['STARBUCKS', 'Dining'],
  ['DUNKIN', 'Dining'],
  ['DUTCH BROS', 'Dining'],
  ['PEETS COFFEE', 'Dining'],
  ['CARIBOU COFFEE', 'Dining'],
  ['GRUBHUB', 'Dining'],
  ['DOORDASH', 'Dining'],
  ['UBER EATS', 'Dining'],
  ['POSTMATES', 'Dining'],
  ['SEAMLESS', 'Dining'],
  ['INSTACART RESTAURANT', 'Dining'],
  ['RESTAURANT', 'Dining'],
  ['EATERY', 'Dining'],
  ['SUSHI', 'Dining'],
  ['RAMEN', 'Dining'],
  ['PIZZA', 'Dining'],
  ['CAFE', 'Dining'],
  ['DINER', 'Dining'],
  ['GRILL', 'Dining'],
  ['BISTRO', 'Dining'],
  ['BOBA', 'Dining'],
  ['SMOOTHIE KING', 'Dining'],
  ['JAMBA JUICE', 'Dining'],

  // ── Gas / Fuel ─────────────────────────────────────────────────────────────
  ['SHELL', 'Gas'],
  ['CHEVRON', 'Gas'],
  ['EXXON', 'Gas'],
  ['MOBIL', 'Gas'],
  ['BP', 'Gas'],
  ['SUNOCO', 'Gas'],
  ['MARATHON', 'Gas'],
  ['SPEEDWAY', 'Gas'],
  ['WAWA', 'Gas'],
  ['KWIK TRIP', 'Gas'],
  ['CASEY\'S', 'Gas'],
  ['CIRCLE K', 'Gas'],
  ['7-ELEVEN GAS', 'Gas'],
  ['PILOT FLYING J', 'Gas'],
  ['LOVES TRAVEL', 'Gas'],
  ['VALERO', 'Gas'],
  ['ARCO', 'Gas'],
  ['SINCLAIR', 'Gas'],
  ['CONOCO', 'Gas'],
  ['FUEL', 'Gas'],
  ['GAS STATION', 'Gas'],
  ['GASOLINE', 'Gas'],

  // ── Shopping / Retail ─────────────────────────────────────────────────────
  ['AMAZON', 'Shopping'],
  ['TARGET', 'Shopping'],
  ['BEST BUY', 'Shopping'],
  ['HOME DEPOT', 'Shopping'],
  ['LOWE\'S', 'Shopping'],
  ['IKEA', 'Shopping'],
  ['WAYFAIR', 'Shopping'],
  ['EBAY', 'Shopping'],
  ['ETSY', 'Shopping'],
  ['SHEIN', 'Shopping'],
  ['H&M', 'Shopping'],
  ['ZARA', 'Shopping'],
  ['GAP', 'Shopping'],
  ['OLD NAVY', 'Shopping'],
  ['BANANA REPUBLIC', 'Shopping'],
  ['J CREW', 'Shopping'],
  ['NORDSTROM', 'Shopping'],
  ['MACY\'S', 'Shopping'],
  ['KOHLS', 'Shopping'],
  ['TJ MAXX', 'Shopping'],
  ['MARSHALLS', 'Shopping'],
  ['ROSS', 'Shopping'],
  ['BURLINGTON', 'Shopping'],
  ['DOLLAR TREE', 'Shopping'],
  ['DOLLAR GENERAL', 'Shopping'],
  ['FIVE BELOW', 'Shopping'],
  ['BED BATH', 'Shopping'],
  ['WILLIAMS SONOMA', 'Shopping'],
  ['POTTERY BARN', 'Shopping'],
  ['CRATE AND BARREL', 'Shopping'],
  ['SEPHORA', 'Shopping'],
  ['ULTA', 'Shopping'],
  ['SALLY BEAUTY', 'Shopping'],
  ['CVS', 'Shopping'],
  ['WALGREENS', 'Shopping'],
  ['RITE AID', 'Shopping'],
  ['GAMESTOP', 'Shopping'],
  ['APPLE STORE', 'Shopping'],
  ['MICROSOFT STORE', 'Shopping'],
  ['CHEWY', 'Shopping'],
  ['PETCO', 'Shopping'],
  ['PETSMART', 'Shopping'],

  // ── Transportation ─────────────────────────────────────────────────────────
  ['UBER', 'Transportation'],
  ['LYFT', 'Transportation'],
  ['TAXI', 'Transportation'],
  ['METRO', 'Transportation'],
  ['SUBWAY TRANSIT', 'Transportation'],
  ['BUS', 'Transportation'],
  ['AMTRAK', 'Transportation'],
  ['GREYHOUND', 'Transportation'],
  ['PARKING', 'Transportation'],
  ['TOLL', 'Transportation'],
  ['EZ PASS', 'Transportation'],
  ['FASTRAK', 'Transportation'],
  ['AUTO REPAIR', 'Transportation'],
  ['JIFFY LUBE', 'Transportation'],
  ['FIRESTONE', 'Transportation'],
  ['DISCOUNT TIRE', 'Transportation'],
  ['NTB', 'Transportation'],
  ['VALVOLINE', 'Transportation'],
  ['GOODYEAR', 'Transportation'],
  ['CAR WASH', 'Transportation'],
  ['RENTAL CAR', 'Transportation'],
  ['ENTERPRISE', 'Transportation'],
  ['HERTZ', 'Transportation'],
  ['AVIS', 'Transportation'],
  ['BUDGET RENTAL', 'Transportation'],
  ['ZIPCAR', 'Transportation'],
  ['BIRD SCOOTER', 'Transportation'],
  ['LIME SCOOTER', 'Transportation'],
  ['DMV', 'Transportation'],
  ['VEHICLE REGISTRATION', 'Transportation'],

  // ── Housing / Utilities ───────────────────────────────────────────────────
  ['RENT', 'Housing'],
  ['MORTGAGE', 'Housing'],
  ['HOA', 'Housing'],
  ['PROPERTY TAX', 'Housing'],
  ['ELECTRIC', 'Utilities'],
  ['GAS BILL', 'Utilities'],
  ['WATER BILL', 'Utilities'],
  ['SEWER', 'Utilities'],
  ['TRASH', 'Utilities'],
  ['INTERNET', 'Utilities'],
  ['COMCAST', 'Utilities'],
  ['XFINITY', 'Utilities'],
  ['AT&T', 'Utilities'],
  ['SPECTRUM', 'Utilities'],
  ['VERIZON FIOS', 'Utilities'],
  ['COX COMMUNICATIONS', 'Utilities'],
  ['CENTURY LINK', 'Utilities'],
  ['FRONTIER COMM', 'Utilities'],
  ['PG&E', 'Utilities'],
  ['CON EDISON', 'Utilities'],
  ['DUKE ENERGY', 'Utilities'],
  ['DOMINION ENERGY', 'Utilities'],
  ['SOUTHERN CO', 'Utilities'],
  ['ENTERGY', 'Utilities'],

  // ── Phone ──────────────────────────────────────────────────────────────────
  ['VERIZON', 'Phone'],
  ['T-MOBILE', 'Phone'],
  ['TMOBILE', 'Phone'],
  ['AT&T WIRELESS', 'Phone'],
  ['SPRINT', 'Phone'],
  ['BOOST MOBILE', 'Phone'],
  ['CRICKET WIRELESS', 'Phone'],
  ['MINT MOBILE', 'Phone'],
  ['VISIBLE', 'Phone'],
  ['US CELLULAR', 'Phone'],
  ['METRO PCS', 'Phone'],
  ['TRACFONE', 'Phone'],

  // ── Subscriptions / Streaming ─────────────────────────────────────────────
  ['NETFLIX', 'Subscriptions'],
  ['SPOTIFY', 'Subscriptions'],
  ['HULU', 'Subscriptions'],
  ['DISNEY PLUS', 'Subscriptions'],
  ['DISNEYPLUS', 'Subscriptions'],
  ['HBO MAX', 'Subscriptions'],
  ['HBOMAX', 'Subscriptions'],
  ['APPLE TV', 'Subscriptions'],
  ['AMAZON PRIME', 'Subscriptions'],
  ['PRIME VIDEO', 'Subscriptions'],
  ['YOUTUBE PREMIUM', 'Subscriptions'],
  ['PEACOCK', 'Subscriptions'],
  ['PARAMOUNT PLUS', 'Subscriptions'],
  ['DISCOVERY PLUS', 'Subscriptions'],
  ['APPLE MUSIC', 'Subscriptions'],
  ['TIDAL', 'Subscriptions'],
  ['AUDIBLE', 'Subscriptions'],
  ['KINDLE UNLIMITED', 'Subscriptions'],
  ['ADOBE', 'Subscriptions'],
  ['MICROSOFT 365', 'Subscriptions'],
  ['OFFICE 365', 'Subscriptions'],
  ['GOOGLE ONE', 'Subscriptions'],
  ['DROPBOX', 'Subscriptions'],
  ['ICLOUD', 'Subscriptions'],
  ['APPLE ICLOUD', 'Subscriptions'],
  ['NOTION', 'Subscriptions'],
  ['DUOLINGO', 'Subscriptions'],
  ['NYTIMES', 'Subscriptions'],
  ['WSJONLINE', 'Subscriptions'],
  ['SUBSTACK', 'Subscriptions'],
  ['PATREON', 'Subscriptions'],
  ['TWITCH', 'Subscriptions'],
  ['XBOX GAME PASS', 'Subscriptions'],
  ['PLAYSTATION PLUS', 'Subscriptions'],
  ['NINTENDO', 'Subscriptions'],
  ['PELOTON', 'Subscriptions'],

  // ── Healthcare ────────────────────────────────────────────────────────────
  ['CVS PHARMACY', 'Healthcare'],
  ['WALGREENS PHARMACY', 'Healthcare'],
  ['RITE AID PHARMACY', 'Healthcare'],
  ['OPTUM', 'Healthcare'],
  ['GOODRX', 'Healthcare'],
  ['DOCTOR', 'Healthcare'],
  ['DENTIST', 'Healthcare'],
  ['ORTHODONTIST', 'Healthcare'],
  ['URGENT CARE', 'Healthcare'],
  ['EMERGENCY ROOM', 'Healthcare'],
  ['HOSPITAL', 'Healthcare'],
  ['CLINIC', 'Healthcare'],
  ['MEDICAL', 'Healthcare'],
  ['PHARMACY', 'Healthcare'],
  ['PRESCRIPTION', 'Healthcare'],
  ['HEALTH INSURANCE', 'Healthcare'],
  ['BLUE CROSS', 'Healthcare'],
  ['UNITED HEALTH', 'Healthcare'],
  ['AETNA', 'Healthcare'],
  ['CIGNA', 'Healthcare'],
  ['HUMANA', 'Healthcare'],
  ['KAISER', 'Healthcare'],
  ['THERAPIST', 'Healthcare'],
  ['THERAPY', 'Healthcare'],
  ['COUNSELING', 'Healthcare'],
  ['OPTOMETRIST', 'Healthcare'],
  ['EYE CARE', 'Healthcare'],
  ['VISION', 'Healthcare'],

  // ── Fitness ───────────────────────────────────────────────────────────────
  ['GYM', 'Fitness'],
  ['FITNESS', 'Fitness'],
  ['PLANET FITNESS', 'Fitness'],
  ['24 HOUR FITNESS', 'Fitness'],
  ['CRUNCH GYM', 'Fitness'],
  ['ANYTIME FITNESS', 'Fitness'],
  ['EQUINOX', 'Fitness'],
  ['ORANGETHEORY', 'Fitness'],
  ['CROSSFIT', 'Fitness'],
  ['YOGA', 'Fitness'],
  ['SOUL CYCLE', 'Fitness'],
  ['BARRE', 'Fitness'],
  ['PILATES', 'Fitness'],
  ['CLASSPASS', 'Fitness'],
  ['LIFETIME FITNESS', 'Fitness'],

  // ── Travel ────────────────────────────────────────────────────────────────
  ['AIRBNB', 'Travel'],
  ['VRBO', 'Travel'],
  ['HOTEL', 'Travel'],
  ['MARRIOTT', 'Travel'],
  ['HILTON', 'Travel'],
  ['HYATT', 'Travel'],
  ['IHG', 'Travel'],
  ['EXPEDIA', 'Travel'],
  ['BOOKING.COM', 'Travel'],
  ['PRICELINE', 'Travel'],
  ['KAYAK', 'Travel'],
  ['SOUTHWEST', 'Travel'],
  ['UNITED AIRLINES', 'Travel'],
  ['AMERICAN AIRLINES', 'Travel'],
  ['DELTA AIR', 'Travel'],
  ['JETBLUE', 'Travel'],
  ['ALASKA AIRLINES', 'Travel'],
  ['SPIRIT AIRLINES', 'Travel'],
  ['FRONTIER AIRLINES', 'Travel'],
  ['TSA PRECHECK', 'Travel'],
  ['GLOBAL ENTRY', 'Travel'],
  ['CLEAR LANES', 'Travel'],
  ['BAGGAGE FEE', 'Travel'],
  ['FLIGHT', 'Travel'],
  ['AIRPORT', 'Travel'],

  // ── Education ─────────────────────────────────────────────────────────────
  ['TUITION', 'Education'],
  ['UNIVERSITY', 'Education'],
  ['COLLEGE', 'Education'],
  ['COURSERA', 'Education'],
  ['UDEMY', 'Education'],
  ['SKILLSHARE', 'Education'],
  ['MASTERCLASS', 'Education'],
  ['BOOKS', 'Education'],
  ['CHEGG', 'Education'],
  ['KHAN ACADEMY', 'Education'],
  ['STUDENT LOAN PMT', 'Education'],

  // ── Entertainment / Fun ───────────────────────────────────────────────────
  ['MOVIE TICKET', 'Entertainment'],
  ['AMC THEATRE', 'Entertainment'],
  ['REGAL CINEMA', 'Entertainment'],
  ['FANDANGO', 'Entertainment'],
  ['CONCERT', 'Entertainment'],
  ['TICKETMASTER', 'Entertainment'],
  ['STUBHUB', 'Entertainment'],
  ['EVENTBRITE', 'Entertainment'],
  ['MUSEUM', 'Entertainment'],
  ['ZOO', 'Entertainment'],
  ['AMUSEMENT PARK', 'Entertainment'],
  ['BOWLING', 'Entertainment'],
  ['MINIATURE GOLF', 'Entertainment'],
  ['ESCAPE ROOM', 'Entertainment'],
  ['LASER TAG', 'Entertainment'],
  ['DAVE AND BUSTER', 'Entertainment'],
  ['ARCADE', 'Entertainment'],
  ['STEAM', 'Entertainment'],
  ['EPIC GAMES', 'Entertainment'],
  ['PLAYSTATION', 'Entertainment'],
  ['XBOX', 'Entertainment'],

  // ── Savings / Investments ─────────────────────────────────────────────────
  ['FIDELITY', 'Savings'],
  ['VANGUARD', 'Savings'],
  ['SCHWAB', 'Savings'],
  ['ROBINHOOD', 'Savings'],
  ['WEALTHFRONT', 'Savings'],
  ['BETTERMENT', 'Savings'],
  ['ACORNS', 'Savings'],
  ['ELLEVEST', 'Savings'],
  ['SOFI INVEST', 'Savings'],
  ['AMERITRADE', 'Savings'],
  ['E*TRADE', 'Savings'],
  ['MERRILL LYNCH', 'Savings'],
  ['EDWARD JONES', 'Savings'],
  ['401K', 'Savings'],
  ['ROTH IRA', 'Savings'],
  ['SAVINGS DEPOSIT', 'Savings'],
  ['SAVINGS WITHDRAWAL', 'Savings'],

  // ── Personal Care ─────────────────────────────────────────────────────────
  ['SALON', 'Personal Care'],
  ['HAIR', 'Personal Care'],
  ['BARBER', 'Personal Care'],
  ['SPA', 'Personal Care'],
  ['NAIL', 'Personal Care'],
  ['MASSAGE', 'Personal Care'],
  ['WAXING', 'Personal Care'],
  ['EYEBROW', 'Personal Care'],
  ['LAUNDRY', 'Personal Care'],
  ['DRY CLEANING', 'Personal Care'],

  // ── Charitable / Giving ───────────────────────────────────────────────────
  ['DONATION', 'Charity'],
  ['CHARITY', 'Charity'],
  ['NONPROFIT', 'Charity'],
  ['RED CROSS', 'Charity'],
  ['GOODWILL', 'Charity'],
  ['SALVATION ARMY', 'Charity'],
  ['CHURCH', 'Charity'],
  ['TITHE', 'Charity'],
  ['GOFUNDME', 'Charity'],

  // ── Business / Professional ───────────────────────────────────────────────
  ['OFFICE SUPPLY', 'Business'],
  ['OFFICE DEPOT', 'Business'],
  ['STAPLES', 'Business'],
  ['FEDEX', 'Business'],
  ['UPS STORE', 'Business'],
  ['USPS', 'Business'],
  ['SHIPPING', 'Business'],
  ['LINKEDIN PREMIUM', 'Business'],
  ['ZOOM', 'Business'],
  ['SLACK', 'Business'],
  ['GITHUB', 'Business'],
  ['DIGITALOCEAN', 'Business'],
  ['AWS', 'Business'],
  ['HEROKU', 'Business'],
  ['GOOGLE WORKSPACE', 'Business'],

  // ── ATM / Fees ────────────────────────────────────────────────────────────
  ['ATM WITHDRAWAL', 'ATM & Fees'],
  ['ATM FEE', 'ATM & Fees'],
  ['CASH WITHDRAWAL', 'ATM & Fees'],
  ['BANK FEE', 'ATM & Fees'],
  ['OVERDRAFT FEE', 'ATM & Fees'],
  ['LATE FEE', 'ATM & Fees'],
  ['SERVICE CHARGE', 'ATM & Fees'],
  ['MONTHLY FEE', 'ATM & Fees'],
  ['FOREIGN TRANSACTION', 'ATM & Fees'],
  ['NSF FEE', 'ATM & Fees'],
];

// ─── Income keyword signals ───────────────────────────────────────────────────
const INCOME_SIGNALS: string[] = [
  'PAYROLL', 'DIRECT DEP', 'SALARY', 'WAGES', 'ACH CREDIT', 'EMPLOYER',
  'GUSTO', 'ADP', 'PAYCHEX', 'DIVIDEND', 'INTEREST CREDIT', 'INTEREST EARNED',
  'TAX REFUND', 'IRS TREAS', 'STRIPE PAYOUT', 'SQUARE PAYOUT',
  'FREELANCE', 'CONSULTING FEE', 'COMMISSION', 'BONUS',
];

/**
 * Categorize a single transaction description + amount.
 * @param description  Raw description from bank
 * @param amount       Positive = credit, negative = debit
 * @param merchantRules  Map of merchant → category (from DB)
 * @returns category name string
 */
export function categorizeTransaction(
  description: string,
  amount: number,
  merchantRules: Record<string, string> = {}
): { category: string; autoMatched: boolean } {
  const upper = description.toUpperCase();

  // ── 1. Merchant rules (highest priority) ──────────────────────────────────
  for (const [merchant, category] of Object.entries(merchantRules)) {
    if (upper.includes(merchant.toUpperCase())) {
      return { category, autoMatched: true };
    }
  }

  // ── 2. Positive amounts → check income signals first ─────────────────────
  if (amount > 0) {
    for (const signal of INCOME_SIGNALS) {
      if (upper.includes(signal)) {
        return { category: 'Income', autoMatched: true };
      }
    }
    // Positive amounts with no income signal: might be refund or transfer
    // fall through to keyword map which may catch transfer keywords
  }

  // ── 3. Keyword map ────────────────────────────────────────────────────────
  for (const [keyword, category] of KEYWORD_MAP) {
    if (upper.includes(keyword.toUpperCase())) {
      return { category, autoMatched: true };
    }
  }

  // ── 4. Default ────────────────────────────────────────────────────────────
  // Positive credits that hit no rules → generic income
  if (amount > 0) {
    return { category: 'Income', autoMatched: false };
  }

  return { category: 'Uncategorized', autoMatched: false };
}

/**
 * Batch categorize an array of raw transactions.
 */
export function autoCategorize(
  transactions: { description: string; amount: number; category?: string }[],
  merchantRules: Record<string, string> = {}
): { category: string; autoMatched: boolean }[] {
  return transactions.map(t => {
    // Don't overwrite if already categorized (non-default)
    if (t.category && t.category !== 'Uncategorized') {
      return { category: t.category, autoMatched: false };
    }
    return categorizeTransaction(t.description, t.amount, merchantRules);
  });
}
