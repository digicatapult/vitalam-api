FROM node:16-alpine

COPY . .
ARG TARGETPLATFORM
RUN if [ "$TARGETPLATFORM" = "linux/arm64" ]; then apk add --no-cache python3 make g++; fi
RUN npm install -g npm@8.x.x

RUN npm ci --prod
EXPOSE 3001
CMD ["npm", "run", "start"]
