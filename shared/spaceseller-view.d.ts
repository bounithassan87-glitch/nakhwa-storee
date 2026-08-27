// Types for spaceseller-view.js.
//
// The module is plain JS so both the Workers runtime and the Vite bundle can
// import it as-is. These declarations give the TypeScript call sites — the two
// admin endpoints and the dashboard — real types instead of `any`.

export type SpaceSellerTone = "success" | "warning" | "danger" | "neutral";

/** The `spaceseller` block every order endpoint returns. */
export interface SpaceSellerBlock {
  syncStatus: string | null;
  orderId: string | null;
  uuid: string | null;
  status: string | null;
  deliveryStatus: string | null;
  trackingNumber: string | null;
  /** Date from the server, ISO string once it has been through JSON. */
  syncedAt: Date | string | null;
  error: string | null;
}

/** The columns `toSpaceSellerBlock` reads off an order row. */
export interface SpaceSellerColumns {
  spacesellerSyncStatus?: string | null;
  spacesellerOrderId?: string | null;
  spacesellerUuid?: string | null;
  spacesellerStatus?: string | null;
  spacesellerDeliveryStatus?: string | null;
  spacesellerTrackingNumber?: string | null;
  spacesellerSyncedAt?: Date | string | null;
  spacesellerLastError?: string | null;
}

/** What the retry/refresh endpoint sends back. */
export interface SpaceSellerActionResponse {
  ok?: boolean;
  status?: string | null;
  alreadySynced?: boolean;
  spacesellerOrderId?: string | null;
  spacesellerUuid?: string | null;
  upstreamStatus?: string | null;
  deliveryStatus?: string | null;
  trackingNumber?: string | null;
  error?: string | null;
}

export interface SpaceSellerView {
  label: string;
  tone: SpaceSellerTone;
  /** False only when the product is fulfilled by someone else. */
  retryable: boolean;
  note?: string;
  noteTone: "muted" | "danger";
}

export declare const EMPTY_SPACESELLER: Readonly<SpaceSellerBlock>;

export declare const SPACESELLER_META: Readonly<
  Record<string, { label: string; tone: SpaceSellerTone }>
>;

export declare function toSpaceSellerBlock(
  order: SpaceSellerColumns | null | undefined,
): SpaceSellerBlock;

export declare function spacesellerView(
  ss: Partial<SpaceSellerBlock> | null | undefined,
): SpaceSellerView;

export declare function mergeSpaceSellerResult(
  prev: SpaceSellerBlock | null | undefined,
  res: SpaceSellerActionResponse | null | undefined,
): SpaceSellerBlock;
