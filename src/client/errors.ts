export class SeqError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeqError";
  }
}

export class SeqApiError extends SeqError {
  public readonly status: number;
  public readonly statusText: string;
  public readonly responseBody?: unknown;

  constructor(status: number, statusText: string, message: string, responseBody?: unknown) {
    super(message);
    this.name = "SeqApiError";
    this.status = status;
    this.statusText = statusText;
    this.responseBody = responseBody;
  }
}

export class SeqAuthenticationError extends SeqApiError {
  constructor(message = "Authentication failed. Check your SEQ_API_KEY.", responseBody?: unknown) {
    super(401, "Unauthorized", message, responseBody);
    this.name = "SeqAuthenticationError";
  }
}

export class SeqNotFoundError extends SeqApiError {
  constructor(message: string, responseBody?: unknown) {
    super(404, "Not Found", message, responseBody);
    this.name = "SeqNotFoundError";
  }
}

export class SeqSyntaxError extends SeqError {
  public readonly expression: string;

  constructor(expression: string, message: string) {
    super(`Invalid Seq filter or query expression "${expression}": ${message}`);
    this.name = "SeqSyntaxError";
    this.expression = expression;
  }
}
