/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import fs from "fs";
import path from "path";
import { connect } from "mongoose";
import { MONGO_URI } from "../config";
import { getWarehouseModels } from "../models/db";

async function importCustomers(filePath: string) {
  const { Customer } = getWarehouseModels();
  const raw = fs.readFileSync(filePath, "utf-8");
  const arr = JSON.parse(raw);
  for (const c of arr) {
    const existing = await Customer.findOne({ customerId: c.customerId });
    if (existing) continue;
    const doc = await Customer.create([{
      customerId: c.customerId,
      name: c.name,
      age: c.age,
      gender: c.gender,
      mobile: c.mobile,
      alternateMobile: c.alternateMobile,
      address: c.address,
      city: c.city,
      tags: c.tags || [],
      totalVisits: c.totalVisits || 0,
      totalSpent: c.totalSpent || 0,
      pendingAmount: c.pendingAmount || 0,
      createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
      updatedAt: c.updatedAt ? new Date(c.updatedAt) : undefined,
    }]);
    const saved = doc[0];
    console.log(`Imported customer ${saved.customerId} -> ${saved._id}`);
  }
}

async function importVisits(filePath: string) {
  const { Customer, Visit } = getWarehouseModels();
  const raw = fs.readFileSync(filePath, "utf-8");
  const arr = JSON.parse(raw);
  for (const v of arr) {
    const cust = await Customer.findOne({ customerId: v.customerId });
    if (!cust) {
      console.warn(`Skipping visit for missing customerId ${v.customerId}`);
      continue;
    }
    const doc = await Visit.create([{
      customerId: cust._id,
      visitDate: v.visitDate ? new Date(v.visitDate) : undefined,
      doctorName: v.doctorName,
      shopId: v.shopId,
      remarks: v.remarks,
      createdAt: v.createdAt ? new Date(v.createdAt) : undefined,
    }]);
    console.log(`Imported visit ${doc[0]._id} for customer ${cust.customerId}`);
  }
}

async function importPrescriptions(filePath: string) {
  const { Customer, Visit, Prescription } = getWarehouseModels();
  const raw = fs.readFileSync(filePath, "utf-8");
  const arr = JSON.parse(raw);
  for (const p of arr) {
    const cust = await Customer.findOne({ customerId: p.customerId });
    if (!cust) {
      console.warn(`Skipping prescription for missing customerId ${p.customerId}`);
      continue;
    }
    const visit = p.visitId ? await Visit.findOne({ _id: p.visitId }) : null;
    const doc = await Prescription.create([{
      customerId: cust._id,
      visitId: visit?._id,
      rightEye: p.rightEye,
      leftEye: p.leftEye,
      pd: p.pd,
      notes: p.notes,
      createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
    } as any]);
    console.log(`Imported prescription ${doc[0]._id} for customer ${cust.customerId}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dataDirArg = args.find((a) => a.startsWith("--dataDir="));
  const dataDir = dataDirArg
    ? dataDirArg.split("=")[1]
    : path.join(__dirname, "../migrations/data");

  if (!MONGO_URI) {
    console.error("MONGO_URI not set in environment");
    process.exit(1);
  }

  await connect(MONGO_URI);
  console.log("Connected to MongoDB for migration");

  const customersFile = path.join(dataDir, "customers.json");
  const visitsFile = path.join(dataDir, "visits.json");
  const prescriptionsFile = path.join(dataDir, "prescriptions.json");

  if (fs.existsSync(customersFile)) await importCustomers(customersFile);
  else console.log(`No customers.json found in ${dataDir}`);

  if (fs.existsSync(visitsFile)) await importVisits(visitsFile);
  else console.log(`No visits.json found in ${dataDir}`);

  if (fs.existsSync(prescriptionsFile)) await importPrescriptions(prescriptionsFile);
  else console.log(`No prescriptions.json found in ${dataDir}`);

  console.log("Migration completed");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
