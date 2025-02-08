FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# Install build dependencies for sharp
RUN apk add --no-cache vips-dev build-base python3 py3-pip

# Install netlify-cli globally
RUN npm install -g netlify-cli

COPY . .

ENV MONGODB_URI mongodb://mongo:27017/arrasta_db
ENV BASE_URL http://localhost:8888

EXPOSE 8888

CMD ["netlify", "dev"]