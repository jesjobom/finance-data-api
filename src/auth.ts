import type { FastifyReply, FastifyRequest } from "fastify";

export function requireBearerToken(expectedToken: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const auth = request.headers.authorization;
    if (auth !== `Bearer ${expectedToken}`) {
      reply.status(401).send({ error: { code: "authentication_error", message: "Missing or invalid bearer token" } });
    }
  };
}
