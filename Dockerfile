FROM node:20-alpine
LABEL org.opencontainers.image.title="Atrium Stats"
LABEL org.opencontainers.image.description="Self-hosted Tautulli-replacement dashboard and Wrapped-style year-in-review, built on Sentinel's API"
LABEL org.opencontainers.image.url="https://github.com/LFFPicard/atrium-stats"
LABEL org.opencontainers.image.source="https://github.com/LFFPicard/atrium-stats"
LABEL org.opencontainers.image.licenses="GPL-3.0"
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["npm", "start"]
