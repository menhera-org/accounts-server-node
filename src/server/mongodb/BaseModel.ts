// https://dev.to/ebrahimmfadae/persist-openid-server-data-with-mongodb-5f95

import mongoose, { Schema } from "mongoose";

const BaseModelSchema = new Schema({
  key: { type: String, required: true },
  payload: { type: Object, required: true },
  expiresAt: { type: Date, required: true },
});

/**
 * key must be unique for every model
 */
BaseModelSchema.index(
  { key: 1, "payload.kind": 1 },
  {
    unique: true,
  }
);

/**
 * uid must be unique for every model == Session
 */
BaseModelSchema.index(
  { "payload.uid": 1 },
  {
    unique: true,
    partialFilterExpression: { "payload.kind": "Session" },
  }
);

/**
 * grantId must be unique for every authentication request model
 */
BaseModelSchema.index(
  { "payload.grantId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "payload.kind": {
        $in: [
          "AccessToken",
          "AuthorizationCode",
          "RefreshToken",
          "DeviceCode",
          "BackchannelAuthenticationRequest",
        ],
      },
    },
  }
);

/**
 * userCode must be unique for every model == DeviceCode
 */
BaseModelSchema.index(
  { "payload.userCode": 1 },
  {
    unique: true,
    partialFilterExpression: { "payload.kind": "DeviceCode" },
  }
);

/**
 * says that document must be removed on expiresAt with 0 delay (expireAfterSeconds: 0)
 */
BaseModelSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
  }
);

export const BaseModel = mongoose.model("BaseModel", BaseModelSchema);
