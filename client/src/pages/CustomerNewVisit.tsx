import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import { useToast } from "../context/ToastContext";
import PageSkeleton from "../components/PageSkeleton";
import Modal from "../components/Modal";
import CameraScanner from "../components/CameraScanner";
import {
  ArrowLeft, User, Eye, ShoppingCart, CreditCard, CheckCircle,
  ChevronLeft, ChevronRight, Save, Plus, Trash2, Calendar, X,
  Camera, Activity, Search, Clock, FileText, AlertCircle,
  RefreshCw, Maximize2, Circle, Wrench, Percent, MessageCircle,
  Tag, Grid3X3, ScanLine, FileCheck
} from "lucide-react";

function cleanEyeSet(e: any) {
  if (!e || typeof e !== "object") return undefined;
  const out: any = {};
  for (const k of ["dv", "nv", "pc"]) {
    if (e[k] && typeof e[k] === "object") {
      const vals = Object.entries(e[k]).filter(([_, v]) => v);
      if (vals.length) out[k] = Object.fromEntries(vals);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

const VISIT_TYPES = [
  { value: "new", label: "New Glasses", icon: Eye },
  { value: "frame_change", label: "Frame Change", icon: RefreshCw },
  { value: "new_lens", label: "New Lens", icon: Maximize2 },
  { value: "contact_lens", label: "Contact Lens", icon: Circle },
  { value: "service", label: "Service", icon: Wrench },
  { value: "other", label: "Other", icon: Grid3X3 },
];

const steps = [
  { key: "service", label: "Service", icon: Activity, desc: "Visit type" },
  { key: "prescription", label: "Examination", icon: Eye, desc: "Vision test" },
  { key: "order", label: "Order", icon: ShoppingCart, desc: "Frame & lens" },
  { key: "billing", label: "Billing", icon: CreditCard, desc: "Items & pricing" },
  { key: "payment", label: "Payment", icon: Percent, desc: "Collect & confirm" },
  { key: "confirmation", label: "Confirm", icon: CheckCircle, desc: "Review & save" },
];

export default function CustomerNewVisit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [customer, setCustomer] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState("service");

  const [visitType, setVisitType] = useState("new");
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split("T")[0]);
  const [visitDoctor, setVisitDoctor] = useState("");
  const [visitRemarks, setVisitRemarks] = useState("");

  const [usePrescription, setUsePrescription] = useState(false);
  const [prescription, setPrescription] = useState({
    rightEye: { dv: {}, nv: {}, pc: {} },
    leftEye: { dv: {}, nv: {}, pc: {} },
    pd: "", notes: "", problems: "",
  });

  const [orderFrames, setOrderFrames] = useState<Array<{ sku: string; brand: string; model: string; color: string; price: number }>>([]);
  const [orderLenses, setOrderLenses] = useState<Array<{ sku: string; brand: string; features: string[]; index: string; price: number; coating: string }>>([]);
  const [orderAccessories, setOrderAccessories] = useState<Array<{ name: string; price: number }>>([]);

  const [billItems, setBillItems] = useState<Array<{ description: string; price: number; qty: number }>>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [advancePaid, setAdvancePaid] = useState(0);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionsFor, setSuggestionsFor] = useState<{ type: "frame"; idx: number } | null>(null);
  const [searchTimer, setSearchTimer] = useState<any>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [scanModal, setScanModal] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const countdownRef = useRef<any>(null);
  const savingRef = useRef(false);
  const greetingSent = useRef(false);

  if (loading) return <PageSkeleton page="customerdetail" />;
  if (!customer) return <div className="p-8 text-center text-gray-500">Customer not found</div>;

  return (
    <div className="max-w-5xl mx-auto">

    </div>
  );
}
