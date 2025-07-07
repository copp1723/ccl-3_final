import { beforeAll, afterAll, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { createStorageMock, createLoggerMock } from "./unit/mocks";
import { createEmailServiceMock, createWebhookServiceMock, createBoberdooServiceMock } from "./unit/mocks/services";

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Global test setup
beforeAll(() => {
  // Mock environment variables for tests
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test_db";
  process.env.JWT_SECRET = "test-secret";
  process.env.API_KEY = "test-api-key";
  process.env.CCL_API_KEY = "test-api-key";
  process.env.ENCRYPTION_KEY = "dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcw==";
  process.env.BASE_URL = "http://localhost:5000";
  process.env.FRONTEND_URL = "http://localhost:5173";
});

afterAll(() => {
  // Cleanup after all tests
  vi.restoreAllMocks();
});

// Mock fetch globally for tests
global.fetch = vi.fn();

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1,
})) as any;

// Mock storage module
vi.mock("@server/storage", () => ({
  storage: createStorageMock(),
}));

// Mock logger module
vi.mock("@server/logger", () => ({
  logger: createLoggerMock(),
}));

// Mock service modules
vi.mock("@server/services/email-onerylie", () => ({
  default: createEmailServiceMock(),
}));

vi.mock("@server/services/WebhookService", () => ({
  WebhookService: vi.fn().mockImplementation(() => createWebhookServiceMock()),
}));

vi.mock("@server/services/boberdoo-service", () => ({
  boberdooService: createBoberdooServiceMock(),
}));

// Mock crypto for consistent UUIDs in tests
vi.mock("crypto", () => ({
  ...vi.importActual("crypto"),
  randomUUID: vi.fn(() => "test-uuid-123"),
}));
