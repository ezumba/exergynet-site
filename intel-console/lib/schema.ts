import {
  pgTable, uuid, text, numeric, timestamp,
  jsonb, pgEnum, integer, boolean
} from "drizzle-orm/pg-core";

export const confidenceEnum = pgEnum("confidence", [
  "HIGH", "LOW", "UNVERIFIED"
]);
export const entityTypeEnum = pgEnum("entity_type", [
  "equity", "crypto", "macro", "sensor"
]);

export const entities = pgTable("entities", {
  id:        uuid("id").primaryKey().defaultRandom(),
  type:      entityTypeEnum("type").notNull(),
  name:      text("name").notNull(),
  symbol:    text("symbol"),
  region:    text("region"),
  tags:      jsonb("tags").$type<string[]>().default([]),
  active:    text("active").default("true"),
  createdAt: timestamp("created_at").defaultNow(),
  groundTruthUrl:      text("ground_truth_url"),
  aliases:             jsonb("aliases").$type<string[]>().default([]),
  entitySubtype:       text("entity_subtype").default("standard"),
  agentEnabled:        boolean("agent_enabled").default(true),
  agentFrequency:      text("agent_frequency").default("15min"),
  agentSources:        jsonb("agent_sources").$type<string[]>().default(["market","news","github"]),
  profileData:         jsonb("profile_data").$type<Record<string,unknown>>().default({}),
  lastAgentRun:        timestamp("last_agent_run"),
  baselineReady:       boolean("baseline_ready").default(false),
  disambiguationScore: numeric("disambiguation_score"),
});

export const facts = pgTable("facts", {
  id:         uuid("id").primaryKey().defaultRandom(),
  entityId:   uuid("entity_id").notNull().references(() => entities.id),
  metric:     text("metric").notNull(),
  value:      numeric("value", { precision: 20, scale: 8 }).notNull(),
  unit:       text("unit"),
  sources:    jsonb("sources").$type<string[]>().default([]),
  confidence: confidenceEnum("confidence").default("UNVERIFIED"),
  costUsdc:   numeric("cost_usdc", { precision: 12, scale: 8 }).default("0"),
  fetchedAt:  timestamp("fetched_at").defaultNow(),
});

export const seriesPoints = pgTable("series_points", {
  id:       uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id").notNull().references(() => entities.id),
  metric:   text("metric").notNull(),
  t:        timestamp("t").notNull(),
  value:    numeric("value", { precision: 20, scale: 8 }).notNull(),
});

export const signals = pgTable("signals", {
  id:           uuid("id").primaryKey().defaultRandom(),
  entityId:     uuid("entity_id").notNull().references(() => entities.id),
  metric:       text("metric").notNull(),
  t:            timestamp("t").notNull(),
  signalType:   text("signal_type").notNull(),
  value:        numeric("value", { precision: 20, scale: 8 }),
  params:       jsonb("params").$type<Record<string, unknown>>(),
  confidence:   confidenceEnum("confidence").default("UNVERIFIED"),
});

export const briefs = pgTable("briefs", {
  id:           uuid("id").primaryKey().defaultRandom(),
  narrative:    text("narrative").notNull(),
  topAnomalies: jsonb("top_anomalies").$type<unknown[]>().default([]),
  topMovers:    jsonb("top_movers").$type<unknown[]>().default([]),
  crossDomain:  jsonb("cross_domain").$type<unknown[]>().default([]),
  costUsdc:     numeric("cost_usdc", { precision: 16, scale: 8 }),
  status:       text("status").default("pending"),
  createdAt:    timestamp("created_at").defaultNow(),
});

export const usageEvents = pgTable("usage_events", {
  id:               uuid("id").primaryKey().defaultRandom(),
  operation:        text("operation").notNull(),
  promptTokens:     integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  costUsdc:         numeric("cost_usdc", { precision: 16, scale: 8 }),
  createdAt:        timestamp("created_at").defaultNow(),
});

export const predictions = pgTable("predictions", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  entityId:            uuid("entity_id").references(() => entities.id),
  metric:              text("metric").notNull(),
  signalId:            uuid("signal_id").references(() => signals.id),
  prediction:          text("prediction").notNull(),
  rationale:           text("rationale"),
  zScoreAtVote:        text("z_score_at_vote"),
  cptxCost:            integer("cptx_cost").default(5),
  cptxReward:          integer("cptx_reward").default(0),
  resolved:            boolean("resolved").default(false),
  resolvedCorrect:     boolean("resolved_correct"),
  polymarketMarketId:  text("polymarket_market_id"),
  polymarketQuestion:  text("polymarket_question"),
  polymarketYesPrice:  numeric("polymarket_yes_price", { precision: 10, scale: 6 }),
  polymarketVolume:    numeric("polymarket_volume", { precision: 20, scale: 2 }),
  polymarketEndDate:   timestamp("polymarket_end_date"),
  polymarketResolution: text("polymarket_resolution"),
  createdAt:           timestamp("created_at").defaultNow(),
});

export const cptxBalances = pgTable("cptx_balances", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userKey:     text("user_key").notNull().unique(),
  balance:     integer("balance").notNull().default(100),
  totalSpent:  integer("total_spent").notNull().default(0),
  totalEarned: integer("total_earned").notNull().default(0),
  updatedAt:   timestamp("updated_at").defaultNow(),
});

export const cptxTransactions = pgTable("cptx_transactions", {
  id:           uuid("id").primaryKey().defaultRandom(),
  userKey:      text("user_key").notNull(),
  action:       text("action").notNull(),
  delta:        integer("delta").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  predictionId: uuid("prediction_id"),
  createdAt:    timestamp("created_at").defaultNow(),
});

// Agent tables

export const agentCostEvents = pgTable("agent_cost_events", {
  id:             uuid("id").primaryKey().defaultRandom(),
  entityId:       uuid("entity_id").references(() => entities.id, { onDelete: "cascade" }),
  userKey:        text("user_key").notNull().default("system"),
  operation:      text("operation").notNull(),
  source:         text("source"),
  tokensUsed:     integer("tokens_used").default(0),
  costUsdc:       numeric("cost_usdc", { precision: 16, scale: 8 }).default("0"),
  durationMs:     integer("duration_ms"),
  resultSignals:  integer("result_signals").default(0),
  efficiencyRatio:numeric("efficiency_ratio"),
  createdAt:      timestamp("created_at").defaultNow(),
});

export const agentActivities = pgTable("agent_activities", {
  id:              uuid("id").primaryKey().defaultRandom(),
  entityId:        uuid("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  cycleId:         uuid("cycle_id").notNull().defaultRandom(),
  source:          text("source").notNull(),
  status:          text("status").notNull().default("running"),
  eventsFound:     integer("events_found").default(0),
  signalsProduced: integer("signals_produced").default(0),
  costUsdc:        numeric("cost_usdc", { precision: 16, scale: 8 }).default("0"),
  durationMs:      integer("duration_ms"),
  errorMessage:    text("error_message"),
  createdAt:       timestamp("created_at").defaultNow(),
  completedAt:     timestamp("completed_at"),
});

export const entityEvents = pgTable("entity_events", {
  id:         uuid("id").primaryKey().defaultRandom(),
  entityId:   uuid("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  eventType:  text("event_type").notNull(),
  severity:   text("severity").default("INFO"),
  title:      text("title").notNull(),
  summary:    text("summary"),
  sourceUrl:  text("source_url"),
  sourceName: text("source_name"),
  rawData:    jsonb("raw_data").$type<Record<string,unknown>>().default({}),
  confidence: numeric("confidence", { precision: 5, scale: 4 }).default("0.5"),
  imageUrl:   text("image_url"),
  occurredAt: timestamp("occurred_at").defaultNow(),
  createdAt:  timestamp("created_at").defaultNow(),
});

// ── Ghost-Witness (LNES-05) ───────────────────────────────────────────────────

export const ghostWitnessAudits = pgTable("ghost_witness_audits", {
  id:             uuid("id").primaryKey().defaultRandom(),
  auditId:        text("audit_id").notNull().unique(),
  businessKey:    text("business_key").notNull(),
  platform:       text("platform").notNull().default("whatsapp"),
  conversationId: text("conversation_id"),
  claimCount:     integer("claim_count").notNull().default(0),
  flags:          jsonb("flags").$type<unknown[]>().default([]),
  consistent:     boolean("consistent"),
  confidence:     numeric("confidence", { precision: 5, scale: 4 }),
  vanguardCost:   numeric("vanguard_cost", { precision: 16, scale: 8 }).default("0"),
  settlementCost: numeric("settlement_cost", { precision: 16, scale: 8 }).default("0.005000"),
  txHash:         text("tx_hash"),
  auditHash:      text("audit_hash").notNull(),
  clcUrl:         text("clc_url"),
  status:         text("status").default("pending"),
  createdAt:      timestamp("created_at").defaultNow(),
  completedAt:    timestamp("completed_at"),
});

export const gwApiKeys = pgTable("gw_api_keys", {
  id:            uuid("id").primaryKey().defaultRandom(),
  businessKey:   text("business_key").notNull().unique(),
  keyHash:       text("key_hash").notNull().unique(),
  keyPrefix:     text("key_prefix").notNull(),
  plan:          text("plan").notNull().default("pay_per_audit"),
  auditsMonth:   integer("audits_month").notNull().default(0),
  walletAddress: text("wallet_address"),
  active:        boolean("active").default(true),
  createdAt:     timestamp("created_at").defaultNow(),
});
