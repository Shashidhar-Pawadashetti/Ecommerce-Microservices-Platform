FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
# Run npm install with dns 8.8.8.8 hack only if needed, but normally docker build has internet.
# Since we have DNS issues during npm install in alpine, let's just do it directly.
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
