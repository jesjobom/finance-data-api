import type { FastifyReply } from "fastify";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function notFound(resource: string, id: string): ApiError {
  return new ApiError(404, "not_found", `${resource} not found`, { id });
}

export function validation(message: string, details?: unknown): ApiError {
  return new ApiError(400, "validation_error", message, details);
}

export function conflict(message: string, details?: unknown): ApiError {
  return new ApiError(409, "conflict", message, details);
}

export function sendError(reply: FastifyReply, error: unknown): void {
  if (error instanceof ApiError) {
    reply.status(error.statusCode).send({ error: { code: error.code, message: error.message, details: error.details } });
    return;
  }

  if (error instanceof ZodError) {
    reply.status(400).send({
      error: {
        code: "validation_error",
        message: "Invalid request payload",
        details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      }
    });
    return;
  }

  reply.status(500).send({ error: { code: "internal_error", message: "Unexpected server error" } });
}
