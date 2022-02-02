FROM node:16-alpine

COPY . .

RUN npm install -g npm@8.x.x

RUN npm install --prod
EXPOSE 3001
CMD ["npm", "run", "start"]
