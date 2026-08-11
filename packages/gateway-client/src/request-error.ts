import { formatConnectErrorMessage } from "@astroclaw/gateway-protocol/connect-error-details";
import type { ErrorShape } from "@astroclaw/gateway-protocol/frame-guards";
import { GatewayProtocolRequestError } from "./protocol-request.js";

export class GatewayClientRequestError extends GatewayProtocolRequestError {
  constructor(error: Partial<ErrorShape>) {
    super({
      ...error,
      message: formatConnectErrorMessage({ message: error.message, details: error.details }),
    });
    this.name = "GatewayClientRequestError";
  }
}
