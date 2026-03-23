"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Announcement, AnnouncementType } from "@/types";
import { format } from "date-fns";
import { Edit, Eye, EyeOff, Megaphone, Pin, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

const typeVariant: Record<AnnouncementType, "info" | "warning" | "danger" | "success"> = {
  info: "info",
  warning: "warning",
  maintenance: "danger",
  update: "success",
};

const mockAnnouncements: Announcement[] = [
  {
    id: "ann_001",
    title: "Scheduled Maintenance - March 25",
    content: "We will be performing scheduled maintenance on March 25 from 2:00 AM to 4:00 AM UTC. Trading will be temporarily paused during this window.",
    type: "maintenance",
    active: true,
    pinned: true,
    createdBy: "admin@novex.io",
    createdAt: "2026-03-20T10:00:00Z",
    updatedAt: "2026-03-20T10:00:00Z",
    publishAt: null,
    expiresAt: "2026-03-26T00:00:00Z",
  },
  {
    id: "ann_002",
    title: "New Trading Pair: LINK/USDT Now Available",
    content: "We are excited to announce the addition of LINK/USDT trading pair. Start trading now with competitive maker/taker fees.",
    type: "update",
    active: true,
    pinned: false,
    createdBy: "admin@novex.io",
    createdAt: "2026-03-18T14:00:00Z",
    updatedAt: "2026-03-18T14:00:00Z",
    publishAt: null,
    expiresAt: null,
  },
  {
    id: "ann_003",
    title: "Enhanced Security: Mandatory 2FA Coming Soon",
    content: "Starting April 1, 2026, all users will be required to enable two-factor authentication. Please set up 2FA before this date to avoid interruptions.",
    type: "warning",
    active: true,
    pinned: false,
    createdBy: "compliance@novex.io",
    createdAt: "2026-03-15T09:00:00Z",
    updatedAt: "2026-03-15T09:00:00Z",
    publishAt: null,
    expiresAt: "2026-04-01T00:00:00Z",
  },
  {
    id: "ann_004",
    title: "Fee Reduction Promotion",
    content: "Enjoy 50% reduced trading fees for all pairs during our spring promotion. Valid until March 31.",
    type: "info",
    active: false,
    pinned: false,
    createdBy: "admin@novex.io",
    createdAt: "2026-03-01T10:00:00Z",
    updatedAt: "2026-03-10T12:00:00Z",
    publishAt: null,
    expiresAt: "2026-03-31T23:59:59Z",
  },
  {
    id: "ann_005",
    title: "API V2 Migration Guide",
    content: "Our new API V2 is now available. Please migrate your integrations before May 1, 2026 when V1 will be deprecated.",
    type: "info",
    active: true,
    pinned: false,
    createdBy: "admin@novex.io",
    createdAt: "2026-02-28T08:00:00Z",
    updatedAt: "2026-02-28T08:00:00Z",
    publishAt: null,
    expiresAt: "2026-05-01T00:00:00Z",
  },
];

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState(mockAnnouncements);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "info" as AnnouncementType,
    pinned: false,
  });

  const startEdit = (ann: Announcement) => {
    setFormData({
      title: ann.title,
      content: ann.content,
      type: ann.type,
      pinned: ann.pinned,
    });
    setEditingId(ann.id);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ title: "", content: "", type: "info", pinned: false });
  };

  const toggleActive = (id: string) => {
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Announcements</h1>
          <p className="text-sm text-surface-400">Manage platform announcements and notices</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowForm(true)}>
          New Announcement
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card flex items-center justify-between">
          <span className="text-sm text-surface-400">Total</span>
          <span className="text-lg font-bold text-surface-100">{announcements.length}</span>
        </div>
        <div className="card flex items-center justify-between">
          <span className="text-sm text-surface-400">Active</span>
          <Badge variant="success">{announcements.filter((a) => a.active).length}</Badge>
        </div>
        <div className="card flex items-center justify-between">
          <span className="text-sm text-surface-400">Inactive</span>
          <Badge variant="neutral">{announcements.filter((a) => !a.active).length}</Badge>
        </div>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="card animate-fade-in border-novex-500/30">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-surface-100">
              {editingId ? "Edit Announcement" : "New Announcement"}
            </h3>
            <Button variant="ghost" size="sm" icon={<X className="h-4 w-4" />} onClick={cancelForm} />
          </div>
          <div className="space-y-4">
            <Input
              label="Title"
              placeholder="Announcement title..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-300">Content</label>
              <textarea
                className="block w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 hover:border-surface-600 focus:border-novex-500 focus:outline-none focus:ring-1 focus:ring-novex-500"
                rows={4}
                placeholder="Announcement content..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-surface-300">Type</label>
                <select
                  className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 focus:border-novex-500 focus:outline-none"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as AnnouncementType })}
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="update">Update</option>
                </select>
              </div>
              <div className="flex items-end gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-surface-700 bg-surface-800 px-4 py-2">
                  <input
                    type="checkbox"
                    checked={formData.pinned}
                    onChange={(e) => setFormData({ ...formData, pinned: e.target.checked })}
                    className="h-4 w-4 rounded border-surface-600 bg-surface-700 text-novex-500 focus:ring-novex-500"
                  />
                  <span className="text-sm text-surface-300">Pin to top</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-surface-800 pt-4">
              <Button variant="secondary" onClick={cancelForm}>Cancel</Button>
              <Button>{editingId ? "Update" : "Publish"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Announcement List */}
      <div className="space-y-3">
        {announcements.map((ann) => (
          <div
            key={ann.id}
            className={`card-hover ${!ann.active ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {ann.pinned && <Pin className="h-3.5 w-3.5 text-amber-400" />}
                  <h3 className="text-sm font-semibold text-surface-100">{ann.title}</h3>
                  <Badge variant={typeVariant[ann.type]}>{ann.type.charAt(0).toUpperCase() + ann.type.slice(1)}</Badge>
                  <Badge variant={ann.active ? "success" : "neutral"} dot>
                    {ann.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-surface-400 line-clamp-2">{ann.content}</p>
                <div className="mt-2 flex items-center gap-4 text-xs text-surface-500">
                  <span>By {ann.createdBy}</span>
                  <span>{format(new Date(ann.createdAt), "MMM d, yyyy HH:mm")}</span>
                  {ann.expiresAt && (
                    <span>Expires: {format(new Date(ann.expiresAt), "MMM d, yyyy")}</span>
                  )}
                </div>
              </div>
              <div className="ml-4 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={ann.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  onClick={() => toggleActive(ann.id)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Edit className="h-4 w-4" />}
                  onClick={() => startEdit(ann)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="h-4 w-4 text-red-400" />}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
