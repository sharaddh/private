import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import type { BranchInfo } from '../types';

export interface FormCatalog {
  frameColors: string[];
  lensFeatures: string[];
  lensIndexes: string[];
  lensCoatings: string[];
  accessoryNames: string[];
}

export const DEFAULT_FORM_CATALOG: FormCatalog = {
  frameColors: [
    'Black',
    'Brown',
    'Tortoise',
    'Gold',
    'Silver',
    'Rose Gold',
    'Blue',
    'Grey',
    'Transparent',
  ],
  lensFeatures: [
    'Single Vision',
    'Bifocal',
    'Progressive',
    'Blue Cut',
    'Photochromic',
    'Anti-Glare',
  ],
  lensIndexes: ['1.56', '1.60', '1.61', '1.67', '1.74'],
  lensCoatings: [
    'Anti-Glare',
    'Blue Cut',
    'Scratch Resistant',
    'UV Protection',
    'Photochromic',
    'Hydrophobic',
  ],
  accessoryNames: ['Cleaning Cloth', 'Lens Spray', 'Case', 'Chain', 'Screwdriver Kit', 'Nose Pads'],
};

export const CATALOG_OPTION_HINDI: Record<string, string> = {
  Black: 'काला',
  Brown: 'भूरा',
  Tortoise: 'टॉर्टोइज़',
  Gold: 'गोल्ड',
  Silver: 'सिल्वर',
  'Rose Gold': 'रोज़ गोल्ड',
  Blue: 'नीला',
  Grey: 'ग्रे',
  Transparent: 'पारदर्शी',
  'Anti-Glare': 'एंटी-ग्लेयर',
  'Blue Cut': 'ब्लू कट',
  'Scratch Resistant': 'स्क्रैच रेज़िस्टेंट',
  'UV Protection': 'यूवी प्रोटेक्शन',
  Photochromic: 'फोटोक्रोमिक',
  Hydrophobic: 'हाइड्रोफोबिक',
  'Cleaning Cloth': 'क्लीनिंग कपड़ा',
  'Lens Spray': 'लेंस स्प्रे',
  Case: 'केस',
  Chain: 'चेन',
  'Screwdriver Kit': 'स्क्रूड्राइवर किट',
  'Nose Pads': 'नोज़ पैड',
};

export type CatalogSettings = Partial<Record<keyof FormCatalog, unknown>>;

function normalizeList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function readFormCatalog(settings?: CatalogSettings | null): FormCatalog {
  return {
    frameColors: normalizeList(settings?.frameColors, DEFAULT_FORM_CATALOG.frameColors),
    lensFeatures: normalizeList(settings?.lensFeatures, DEFAULT_FORM_CATALOG.lensFeatures),
    lensIndexes: normalizeList(settings?.lensIndexes, DEFAULT_FORM_CATALOG.lensIndexes),
    lensCoatings: normalizeList(settings?.lensCoatings, DEFAULT_FORM_CATALOG.lensCoatings),
    accessoryNames: normalizeList(settings?.accessoryNames, DEFAULT_FORM_CATALOG.accessoryNames),
  };
}

export function useFormCatalog() {
  const { currentBranch } = useAuth();
  const branchId = currentBranch?._id;
  const branchSettings = currentBranch?.settings as CatalogSettings | undefined;
  const contextCatalog = useMemo(() => readFormCatalog(branchSettings), [branchSettings]);
  const [remote, setRemote] = useState<{ branchId: string; catalog: FormCatalog } | null>(null);

  useEffect(() => {
    if (!branchId) return;

    let active = true;
    api
      .get<BranchInfo>(`/api/branches/${branchId}`)
      .then((res) => {
        if (!active || !res.success || !res.data) return;
        setRemote({
          branchId,
          catalog: readFormCatalog(res.data.settings as CatalogSettings | undefined),
        });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [branchId]);

  return remote && remote.branchId === branchId ? remote.catalog : contextCatalog;
}
