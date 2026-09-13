export interface DemandItem {
  _id: string;
  listId: string;
  coating: string;
  lensType: string;
  powerKey: string;
  qty: number;
}

export interface DemandList {
  _id: string;
  status: 'open' | 'sent' | 'closed';
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  closedAt: string | null;
  createdBy: string;
  items: DemandItem[];
}
