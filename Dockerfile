FROM node:22
WORKDIR /app
COPY . .
RUN npm run setup
ENV NODE_ENV=production PORT=4000 DB_FILE=/data/saath.db
VOLUME /data
EXPOSE 4000
CMD ["node", "server/index.js"]
