# API Documentation

## Base URL

`http://localhost:3000/api/fraud-detection`

## Endpoints

### 1. Check Transaction Risk

Evaluates a transaction for potential fraud.

**Endpoint:** `POST /check`

**Request Body:**

```json
{
  "userId": "string",
  "amount": number,
  "transactionType": "TRANSFER" | "CARD" | "QR" | "POS",
  "deviceId": "string",
  "beneficiaryAccountNumber": "string",  // Optional
  "beneficiaryBankCode": "string",       // Optional
  "merchantId": "string",                // Optional
  "location": {                          // Optional
    "latitude": number,
    "longitude": number
  },
  "cardDetails": {                       // Optional, for card transactions
    "last4": "string",
    "bin": "string",
    "country": "string"
  }
}
```

**Response:**

```json
{
  "transactionId": "string",
  "riskScore": number,        // 0 to 1, where 1 is highest risk
  "isHighRisk": boolean,
  "reasons": ["string"],      // Array of risk factors
  "recommendedAction": "ALLOW" | "DENY"
}
```

### 2. Report Fraud

Report whether a transaction was actually fraudulent for model training.

**Endpoint:** `POST /report-fraud`

**Request Body:**

```json
{
  "transactionId": "string",
  "wasActuallyFraud": boolean
}
```

**Response:**

```json
{
  "message": "Fraud report processed successfully"
}
```

### 3. Get Statistics

Get transaction statistics and risk distribution.

**Endpoint:** `GET /stats`

**Response:**

```json
{
  "last24Hours": [
    {
      "_id": "PENDING" | "APPROVED" | "DENIED" | "FLAGGED",
      "count": number,
      "totalAmount": number
    }
  ],
  "riskDistribution": [
    {
      "_id": "LOW" | "MEDIUM" | "HIGH",
      "count": number
    }
  ]
}
```

## Error Responses

All endpoints may return these error responses:

```json
{
  "error": "Missing required fields"
}
```

Status: 400

```json
{
  "error": "Internal server error"
}
```

Status: 500

## Usage Examples

### 1. Check a Transfer Transaction

```bash
curl -X POST http://localhost:3000/api/fraud-detection/check \
-H "Content-Type: application/json" \
-d '{
  "userId": "user123",
  "amount": 50000,
  "transactionType": "TRANSFER",
  "deviceId": "device123",
  "beneficiaryAccountNumber": "0123456789",
  "beneficiaryBankCode": "057",
  "location": {
    "latitude": 6.5244,
    "longitude": 3.3792
  }
}'
```

### 2. Check a Card Transaction

```bash
curl -X POST http://localhost:3000/api/fraud-detection/check \
-H "Content-Type: application/json" \
-d '{
  "userId": "user123",
  "amount": 25000,
  "transactionType": "CARD",
  "deviceId": "device123",
  "cardDetails": {
    "last4": "1234",
    "bin": "539983",
    "country": "NG"
  },
  "location": {
    "latitude": 6.5244,
    "longitude": 3.3792
  }
}'
```

### 3. Report Fraud

```bash
curl -X POST http://localhost:3000/api/fraud-detection/report-fraud \
-H "Content-Type: application/json" \
-d '{
  "transactionId": "60f1a5b9e6b3a2001f3e5d8c",
  "wasActuallyFraud": true
}'
```

### 4. Get Statistics

```bash
curl http://localhost:3000/api/fraud-detection/stats
```
