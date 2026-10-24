export type SitemapErrorCode =
  | 'INVALID_INPUT'
  | 'XML_PARSE_ERROR'
  | 'LIMIT_EXCEEDED'
  | 'INVALID_URL'
  | 'FETCH_ERROR'
  | 'UNSAFE_ADDRESS'
  | 'TIMEOUT'
  | 'CIRCULAR_REFERENCE';

export class SitemapError extends Error {
  readonly code: SitemapErrorCode;

  constructor(message: string, code: SitemapErrorCode, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class SitemapParseError extends SitemapError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'XML_PARSE_ERROR', options);
  }
}

export class SitemapValidationError extends SitemapError {
  constructor(message: string, code: 'INVALID_INPUT' | 'INVALID_URL' = 'INVALID_INPUT', options?: ErrorOptions) {
    super(message, code, options);
  }
}

export class SitemapLimitError extends SitemapError {
  constructor(message: string) {
    super(message, 'LIMIT_EXCEEDED');
  }
}

export class SitemapFetchError extends SitemapError {
  constructor(
    message: string,
    code: 'FETCH_ERROR' | 'UNSAFE_ADDRESS' | 'TIMEOUT' | 'CIRCULAR_REFERENCE' = 'FETCH_ERROR',
    options?: ErrorOptions,
  ) {
    super(message, code, options);
  }
}
