export interface ClefEvent {
  "@t": string; // ISO timestamp
  "@mt": string; // Message template
  "@l"?: string; // Level: Verbose, Debug, Information, Warning, Error, Fatal
  "@x"?: string; // Exception stack trace
  [key: string]: unknown;
}

export interface GeneratorOptions {
  count?: number;
  daysLookback?: number;
  serverUrl?: string;
  apiKey?: string;
}

const SERVICES = [
  "api-gateway",
  "auth-service",
  "order-service",
  "payment-service",
  "inventory-service",
  "notification-service",
  "shipping-service"
];

const ENVIRONMENTS = ["production", "staging", "development"];
const HOSTS = ["srv-worker-01", "srv-worker-02", "srv-k8s-pod-99", "srv-k8s-pod-104"];

const USERS = ["alice", "bob", "charlie", "david", "elena", "frank", "grace"];
const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE"];
const HTTP_PATHS = [
  "/api/v1/auth/login",
  "/api/v1/orders",
  "/api/v1/orders/checkout",
  "/api/v1/payments/process",
  "/api/v1/inventory/items",
  "/api/v1/notifications/email",
  "/healthz",
  "/metrics"
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomHex(length: number): string {
  let hex = "";
  while (hex.length < length) {
    hex += Math.random().toString(16).substring(2);
  }
  return hex.substring(0, length);
}

/**
 * Generate a list of realistic structured log events spread across time.
 */
export function generateTestEvents(count = 100, daysLookback = 3): ClefEvent[] {
  const events: ClefEvent[] = [];
  const now = Date.now();
  const timeSpanMs = daysLookback * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    // Generate timestamps distributed across the lookback period
    const eventTimeMs = now - Math.floor(Math.random() * timeSpanMs);
    const timestamp = new Date(eventTimeMs).toISOString();

    const service = randomChoice(SERVICES);
    const environment = randomChoice(ENVIRONMENTS);
    const host = randomChoice(HOSTS);
    const traceId = randomHex(32);
    const spanId = randomHex(16);
    const user = randomChoice(USERS);

    // Pick event category: normal web request, database query, background job, auth, or error
    const category = Math.random();

    let event: ClefEvent;

    if (category < 0.35) {
      // 1. Successful HTTP Web Request
      const method = randomChoice(HTTP_METHODS);
      const path = randomChoice(HTTP_PATHS);
      const statusCode = method === "POST" ? 201 : 200;
      const elapsed = randomFloat(10, 250);

      event = {
        "@t": timestamp,
        "@mt": "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {ElapsedMilliseconds} ms",
        "@l": "Information",
        RequestMethod: method,
        RequestPath: path,
        StatusCode: statusCode,
        ElapsedMilliseconds: elapsed,
        Application: service,
        Environment: environment,
        MachineName: host,
        TraceId: traceId,
        SpanId: spanId,
        UserId: user,
        ClientIp: `192.168.1.${randomInt(10, 250)}`
      };
    } else if (category < 0.50) {
      // 2. Authentication & Security Events
      const isSuccess = Math.random() > 0.15;
      if (isSuccess) {
        event = {
          "@t": timestamp,
          "@mt": "User {Username} successfully authenticated via {AuthMethod}",
          "@l": "Information",
          Username: user,
          AuthMethod: "OAuth2 / JWT",
          Application: "auth-service",
          Environment: environment,
          MachineName: host,
          TraceId: traceId,
          ClientIp: `10.0.0.${randomInt(2, 254)}`
        };
      } else {
        event = {
          "@t": timestamp,
          "@mt": "Failed login attempt for user {Username} from IP {ClientIp}: Invalid credentials (attempt {AttemptCount}/5)",
          "@l": "Warning",
          Username: user,
          AttemptCount: randomInt(1, 4),
          Application: "auth-service",
          Environment: environment,
          MachineName: host,
          TraceId: traceId,
          ClientIp: `198.51.100.${randomInt(1, 100)}`
        };
      }
    } else if (category < 0.65) {
      // 3. E-commerce Business Operations (Order, Checkout, Payment)
      const orderId = `ord_${randomInt(100000, 999999)}`;
      const amount = randomFloat(15, 1200);

      if (Math.random() > 0.2) {
        event = {
          "@t": timestamp,
          "@mt": "Order {OrderId} placed successfully for customer {CustomerName} totaling ${TotalAmount} ({Currency})",
          "@l": "Information",
          OrderId: orderId,
          CustomerName: user,
          TotalAmount: amount,
          Currency: "USD",
          ItemCount: randomInt(1, 8),
          PaymentMethod: randomChoice(["CreditCard", "ApplePay", "PayPal"]),
          Application: "order-service",
          Environment: environment,
          MachineName: host,
          TraceId: traceId
        };
      } else {
        event = {
          "@t": timestamp,
          "@mt": "Payment transaction failed for order {OrderId}: Payment gateway rejected the transaction",
          "@l": "Error",
          "@x": `System.InvalidOperationException: Payment rejected by upstream provider (Code: CARD_DECLINED)\n   at PaymentService.Services.StripeProcessor.ProcessChargeAsync(Order order)\n   at PaymentService.Controllers.PaymentsController.SubmitAsync(PaymentRequest req) in /app/Controllers/PaymentsController.cs:line 84`,
          OrderId: orderId,
          CustomerName: user,
          TotalAmount: amount,
          GatewayStatus: "CARD_DECLINED",
          Application: "payment-service",
          Environment: environment,
          MachineName: host,
          TraceId: traceId
        };
      }
    } else if (category < 0.80) {
      // 4. Performance & High Latency Warning / Cache / Database
      const queryDuration = randomFloat(1500, 4800);
      const table = randomChoice(["Orders", "Users", "InventoryReservations", "AuditLogs"]);

      event = {
        "@t": timestamp,
        "@mt": "Slow database query detected on table {TableName}: executed in {QueryDurationMs} ms (threshold: 1000 ms)",
        "@l": "Warning",
        TableName: table,
        QueryDurationMs: queryDuration,
        RowsAffected: randomInt(500, 50000),
        Application: service,
        Environment: environment,
        MachineName: host,
        TraceId: traceId
      };
    } else if (category < 0.93) {
      // 5. Application Errors & Exceptions
      const errType = randomChoice([
        {
          msg: "Unhandled exception while communicating with downstream microservice {TargetService}",
          level: "Error",
          target: "inventory-service",
          ex: `System.Net.Http.HttpRequestException: Response status code does not indicate success: 504 (Gateway Timeout).\n   at System.Net.Http.HttpClient.SendAsyncCore(HttpRequestMessage request, HttpCompletionOption completionOption)\n   at OrderService.Clients.InventoryClient.ReserveStockAsync(String sku, Int32 quantity) in /src/Clients/InventoryClient.cs:line 52\n   at OrderService.Handlers.CheckoutHandler.Handle(CheckoutCommand cmd) in /src/Handlers/CheckoutHandler.cs:line 119`
        },
        {
          msg: "Database deadlock detected during transaction rollback for customer account {UserId}",
          level: "Error",
          target: "postgres-cluster",
          ex: `Npgsql.PostgresException (0x80004005): 40P01: deadlock detected\nDETAIL: Process 29482 waits for ExclusiveLock on transaction 8291; blocked by process 29501.\n   at Npgsql.Internal.NpgsqlConnector.ReadMessage(Boolean async, DataRowLoadingMode dataRowLoadingMode)\n   at PaymentService.Data.LedgerRepository.ExecuteDebitAsync(Guid accountId, Decimal amount) in /src/Data/LedgerRepository.cs:line 68`
        },
        {
          msg: "Redis cache connection timeout while retrieving session key {SessionKey}",
          level: "Error",
          target: "redis-cache",
          ex: `StackExchange.Redis.RedisTimeoutException: Timeout performing GET (5000ms), next: GET sess:91823, inst: 1, qu: 0, qs: 0, aw: False, bw: CheckingForTimeout, rs: ReadLoop\n   at StackExchange.Redis.ConnectionMultiplexer.ExecuteSyncImpl[T](Message message, ResultProcessor\`1 processor, ServerEndPoint server)`
        }
      ]);

      event = {
        "@t": timestamp,
        "@mt": errType.msg,
        "@l": errType.level,
        "@x": errType.ex,
        TargetService: errType.target,
        SessionKey: `sess_${randomHex(16)}`,
        UserId: user,
        Application: service,
        Environment: environment,
        MachineName: host,
        TraceId: traceId
      };
    } else {
      // 6. Fatal Crash / Critical Outage
      event = {
        "@t": timestamp,
        "@mt": "FATAL: System out of memory or unrecoverable host crash on node {MachineName} in {Environment}",
        "@l": "Fatal",
        "@x": `System.OutOfMemoryException: Exception of type 'System.OutOfMemoryException' was thrown.\n   at System.GC.AllocateNewArray(IntPtr typeHandle, Int32 length, GC_ALLOC_FLAGS flags)\n   at DataIngestionService.Buffer.CircularMemoryPool.Allocate(Int64 bytes)\n   at DataIngestionService.Workers.StreamConsumer.ProcessStreamLoop() in /src/Workers/StreamConsumer.cs:line 210`,
        Application: service,
        Environment: environment,
        MachineName: host,
        TraceId: traceId,
        AvailableMemoryMb: randomInt(2, 35)
      };
    }

    events.push(event);
  }

  // Sort chronologically ascending
  events.sort((a, b) => new Date(a["@t"]).getTime() - new Date(b["@t"]).getTime());

  return events;
}

/**
 * Ingest test events into Seq via the CLEF endpoint.
 */
export async function dumpTestData(options: {
  serverUrl?: string;
  apiKey?: string;
  count?: number;
  daysLookback?: number;
  batchSize?: number;
}): Promise<{ ingestedCount: number; batchesCount: number }> {
  const serverUrl = (options.serverUrl || process.env.SEQ_SERVER_URL || "http://localhost:5341").replace(/\/+$/, "");
  const apiKey = options.apiKey || process.env.SEQ_API_KEY;
  const count = options.count ?? 100;
  const daysLookback = options.daysLookback ?? 3;
  const batchSize = options.batchSize ?? 50;

  const events = generateTestEvents(count, daysLookback);

  const headers: Record<string, string> = {
    "Content-Type": "application/vnd.serilog.clef"
  };

  if (apiKey) {
    headers["X-Seq-ApiKey"] = apiKey;
  }

  let totalIngested = 0;
  let batchIndex = 0;

  for (let i = 0; i < events.length; i += batchSize) {
    batchIndex++;
    const batch = events.slice(i, i + batchSize);
    // Convert to newline-delimited JSON (CLEF format)
    const ndjson = batch.map((evt) => JSON.stringify(evt)).join("\n");

    const endpoint = `${serverUrl}/ingest/clef`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: ndjson
    });

    if (!response.ok) {
      // If /ingest/clef fails, try fallback /api/events/raw?clef
      const fallbackEndpoint = `${serverUrl}/api/events/raw?clef`;
      const fallbackResponse = await fetch(fallbackEndpoint, {
        method: "POST",
        headers,
        body: ndjson
      });

      if (!fallbackResponse.ok) {
        let errText = "";
        try {
          errText = await fallbackResponse.text();
        } catch {
          // ignore
        }
        throw new Error(
          `Failed to ingest batch ${batchIndex} into Seq (${fallbackResponse.status} ${fallbackResponse.statusText}): ${errText || response.statusText}`
        );
      }
    }

    totalIngested += batch.length;
  }

  return {
    ingestedCount: totalIngested,
    batchesCount: batchIndex
  };
}
