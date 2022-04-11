FROM node:16-alpine

COPY . .

RUN npm install -g npm@8.x.x

RUN --mount=type=secret,id=github GITHUB_PACKAGE_TOKEN=$(cat /run/secrets/github) npm install --prod
EXPOSE 3001
CMD ["npm", "run", "start"]
