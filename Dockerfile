FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN apk add --no-cache bash libc6-compat openssl curl

RUN npx prisma generate



EXPOSE 3001

# Start server (index.js) and bind to 0.0.0.0
CMD ["node", "index.js"]
