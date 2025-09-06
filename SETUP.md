# Local Development Setup Guide

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Docker (recommended for easy database setup)

## Database Setup

### 1. MongoDB

Using Docker:

```bash
# Pull MongoDB image
docker pull mongo

# Run MongoDB container
docker run --name fraud-detection-mongo -p 27018:27017 -d mongo

# Check if it's running
docker ps
```

Without Docker:

1. Download MongoDB Community Edition from https://www.mongodb.com/try/download/community
2. Install and start the MongoDB service

### 2. Redis

Using Docker:

```bash
# Pull Redis image
docker pull redis

# Run Redis container
docker run --name fraud-detection-redis -p 6380:6379 -d redis

# Test connection
redis-cli -p 6380 ping
```

Without Docker:

1. Install Redis from https://redis.io/download
2. Start Redis server: `redis-server`

### 3. Neo4j

Using Docker:

```bash
# Pull Neo4j image
docker pull neo4j

# Run Neo4j container
docker run --name fraud-detection-neo4j \
    -p 7474:7474 -p 7687:7687 \
    -e NEO4J_AUTH=neo4j/yourpassword \
    -d neo4j
```

Without Docker:

1. Download Neo4j Desktop from https://neo4j.com/download/
2. Create a new database and start it

### 4. Elasticsearch

Using Docker:

```bash
# Pull Elasticsearch image
docker pull elasticsearch:8.10.2

# Run Elasticsearch container
docker run --name fraud-detection-elastic \
    -p 9200:9200 -p 9300:9300 \
    -e "discovery.type=single-node" \
    -e "xpack.security.enabled=false" \
    -d elasticsearch:8.10.2
```

Without Docker:

1. Download Elasticsearch from https://www.elastic.co/downloads/elasticsearch
2. Extract and run: `./bin/elasticsearch`

## Application Setup

1. Install dependencies:

```bash
npm install
```

2. Create .env file:

```bash
cp .env.example .env
```

3. Update .env with your configurations:

```env
PORT=3000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://localhost:27017/fraud-detection

# Redis
REDIS_HOST=localhost
REDIS_PORT=6380

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=frauddetection123

# Elasticsearch
ELASTIC_URL=http://localhost:9200
```

4. Start the application:

```bash
npm run dev
```

## Testing the Setup

1. Health check:

```bash
curl http://localhost:3000/health
```

2. Test transaction:

```bash
curl -X POST http://localhost:3000/api/fraud-detection/check \
-H "Content-Type: application/json" \
-d '{
  "userId": "test123",
  "amount": 50000,
  "transactionType": "TRANSFER",
  "deviceId": "device123",
  "location": {
    "latitude": 6.5244,
    "longitude": 3.3792
  }
}'
```
