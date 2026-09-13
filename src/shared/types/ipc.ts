export type IpcResult<T> =
  | { ok: true; data: T; error?: never }
  | { ok: false; error: string; data?: never };

export type IpcHandler<TPayload, TResult> = (
  payload: TPayload,
) => Promise<IpcResult<TResult>> | IpcResult<TResult>;
