'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  X,
  Loader2,
  ArrowRightLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  p2pApi,
  type P2pListingDto,
  type P2pOrderDto,
} from '@/lib/api';

type Tab = 'buy' | 'sell';

const ASSETS = ['BTC', 'ETH', 'USDT', 'SOL'];
const FIATS = ['USD', 'EUR', 'GBP', 'TRY'];
const PAYMENT_METHODS = ['Bank Transfer', 'PayPal', 'Wise', 'Revolut', 'Cash'];

export default function P2pPage() {
  const [tab, setTab] = useState<Tab>('buy');
  const [listings, setListings] = useState<P2pListingDto[]>([]);
  const [myOrders, setMyOrders] = useState<P2pOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterAsset, setFilterAsset] = useState('');
  const [filterFiat, setFilterFiat] = useState('');

  // Create listing modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    type: 'sell' as Tab,
    asset: 'BTC',
    fiatCurrency: 'USD',
    price: '',
    minAmount: '',
    maxAmount: '',
    totalAmount: '',
    paymentMethods: [] as string[],
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Buy/Sell modal
  const [orderModal, setOrderModal] = useState<P2pListingDto | null>(null);
  const [orderAmount, setOrderAmount] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState('');

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [listingsData, ordersData] = await Promise.all([
        p2pApi.getListings({
          type: tab === 'buy' ? 'sell' : 'buy',
          asset: filterAsset || undefined,
          fiatCurrency: filterFiat || undefined,
        }),
        p2pApi.getMyOrders().catch(() => [] as P2pOrderDto[]),
      ]);
      setListings(listingsData);
      setMyOrders(ordersData);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load P2P data');
    } finally {
      setLoading(false);
    }
  }, [tab, filterAsset, filterFiat]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateListing = async () => {
    setCreateLoading(true);
    setCreateError('');
    try {
      await p2pApi.createListing(createForm);
      setShowCreate(false);
      setCreateForm({
        type: 'sell',
        asset: 'BTC',
        fiatCurrency: 'USD',
        price: '',
        minAmount: '',
        maxAmount: '',
        totalAmount: '',
        paymentMethods: [],
      });
      await loadData();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create listing',
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!orderModal || !orderAmount) return;
    setOrderLoading(true);
    setOrderError('');
    try {
      await p2pApi.createOrder(orderModal.id, orderAmount);
      setOrderModal(null);
      setOrderAmount('');
      await loadData();
    } catch (err) {
      setOrderError(
        err instanceof Error ? err.message : 'Failed to create order',
      );
    } finally {
      setOrderLoading(false);
    }
  };

  const handleAction = async (
    orderId: string,
    action: 'paid' | 'release' | 'cancel',
  ) => {
    setActionLoading(orderId);
    try {
      if (action === 'paid') await p2pApi.markAsPaid(orderId);
      else if (action === 'release') await p2pApi.releaseCrypto(orderId);
      else await p2pApi.cancelOrder(orderId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} order`);
    } finally {
      setActionLoading(null);
    }
  };

  const togglePayment = (method: string) => {
    setCreateForm((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.includes(method)
        ? prev.paymentMethods.filter((m) => m !== method)
        : [...prev.paymentMethods, method],
    }));
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock size={14} className="text-nvx-text-muted" />;
      case 'paid':
        return <AlertTriangle size={14} className="text-yellow-400" />;
      case 'released':
        return <CheckCircle2 size={14} className="text-nvx-buy" />;
      case 'cancelled':
        return <XCircle size={14} className="text-nvx-sell" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-nvx-bg-primary min-h-[calc(100vh-56px)] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-nvx-text-primary flex items-center gap-2">
              <Users size={22} className="text-nvx-primary" />
              P2P Trading
            </h1>
            <p className="text-sm text-nvx-text-muted mt-1">
              Buy and sell crypto directly with other users
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-nvx-primary text-white text-sm font-medium hover:bg-nvx-primary/90 transition-colors"
          >
            <Plus size={16} />
            Create Listing
          </button>
        </div>

        {error && (
          <div className="bg-nvx-sell/10 border border-nvx-sell/30 text-nvx-sell text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-nvx-bg-secondary border border-nvx-border rounded-lg p-1 w-fit">
          {(['buy', 'sell'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t
                  ? t === 'buy'
                    ? 'bg-nvx-buy text-white'
                    : 'bg-nvx-sell text-white'
                  : 'text-nvx-text-secondary hover:text-nvx-text-primary'
              }`}
            >
              {t === 'buy' ? 'Buy' : 'Sell'}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={filterAsset}
            onChange={(e) => setFilterAsset(e.target.value)}
            className="px-3 py-2 bg-nvx-bg-secondary border border-nvx-border rounded-lg text-sm text-nvx-text-primary focus:outline-none focus:border-nvx-primary"
          >
            <option value="">All Assets</option>
            {ASSETS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            value={filterFiat}
            onChange={(e) => setFilterFiat(e.target.value)}
            className="px-3 py-2 bg-nvx-bg-secondary border border-nvx-border rounded-lg text-sm text-nvx-text-primary focus:outline-none focus:border-nvx-primary"
          >
            <option value="">All Fiat</option>
            {FIATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Listings */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2
              size={24}
              className="animate-spin text-nvx-primary mx-auto mb-2"
            />
            <p className="text-sm text-nvx-text-muted">Loading listings...</p>
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-12 bg-nvx-bg-secondary border border-nvx-border rounded-xl">
            <ArrowRightLeft
              size={32}
              className="text-nvx-text-muted mx-auto mb-3"
            />
            <p className="text-sm text-nvx-text-muted">
              No listings found. Try changing filters or create a listing.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-5 hover:border-nvx-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-nvx-primary/20 flex items-center justify-center text-nvx-primary text-xs font-bold">
                      {listing.asset.slice(0, 1)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-nvx-text-primary">
                        {listing.asset}/{listing.fiatCurrency}
                      </p>
                      <p className="text-[10px] text-nvx-text-muted">
                        User {listing.userId.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                      listing.type === 'sell'
                        ? 'bg-nvx-sell/10 text-nvx-sell'
                        : 'bg-nvx-buy/10 text-nvx-buy'
                    }`}
                  >
                    {listing.type === 'sell' ? 'Selling' : 'Buying'}
                  </span>
                </div>

                {/* Price */}
                <div className="mb-3">
                  <p className="text-xs text-nvx-text-muted mb-0.5">Price</p>
                  <p className="text-xl font-bold text-nvx-text-primary font-mono">
                    {parseFloat(listing.price).toLocaleString()}{' '}
                    <span className="text-xs text-nvx-text-muted">
                      {listing.fiatCurrency}
                    </span>
                  </p>
                </div>

                {/* Limits */}
                <div className="space-y-1.5 text-xs mb-3">
                  <div className="flex justify-between text-nvx-text-secondary">
                    <span>Limits</span>
                    <span className="text-nvx-text-primary font-mono">
                      {listing.minAmount} - {listing.maxAmount} {listing.asset}
                    </span>
                  </div>
                  <div className="flex justify-between text-nvx-text-secondary">
                    <span>Available</span>
                    <span className="text-nvx-text-primary font-mono">
                      {(
                        parseFloat(listing.totalAmount) -
                        parseFloat(listing.filledAmount)
                      ).toFixed(6)}{' '}
                      {listing.asset}
                    </span>
                  </div>
                </div>

                {/* Payment methods */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {listing.paymentMethods.map((pm) => (
                    <span
                      key={pm}
                      className="text-[10px] bg-nvx-bg-tertiary text-nvx-text-secondary px-2 py-0.5 rounded"
                    >
                      {pm}
                    </span>
                  ))}
                </div>

                {/* Action */}
                <button
                  onClick={() => {
                    setOrderModal(listing);
                    setOrderAmount('');
                    setOrderError('');
                  }}
                  className={`w-full py-2 px-4 rounded-lg text-white text-sm font-medium transition-colors ${
                    tab === 'buy'
                      ? 'bg-nvx-buy hover:bg-nvx-buy/90'
                      : 'bg-nvx-sell hover:bg-nvx-sell/90'
                  }`}
                >
                  {tab === 'buy' ? 'Buy' : 'Sell'} {listing.asset}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* My Orders */}
        <h2 className="text-base font-semibold text-nvx-text-primary mb-3">
          My Orders
        </h2>
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-nvx-border text-nvx-text-muted text-xs">
                  <th className="text-left py-3 px-4 font-medium">Order</th>
                  <th className="text-right py-3 px-4 font-medium">Amount</th>
                  <th className="text-right py-3 px-4 font-medium">
                    Fiat Amount
                  </th>
                  <th className="text-right py-3 px-4 font-medium">Status</th>
                  <th className="text-right py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {myOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-12 text-nvx-text-muted text-sm"
                    >
                      No P2P orders yet.
                    </td>
                  </tr>
                ) : (
                  myOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-nvx-border/30 hover:bg-nvx-bg-tertiary/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="text-sm font-medium text-nvx-text-primary font-mono">
                          {order.id.slice(0, 8)}...
                        </p>
                        <p className="text-[10px] text-nvx-text-muted">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary">
                        {parseFloat(order.amount).toFixed(6)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary">
                        {parseFloat(order.fiatAmount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1">
                          {statusIcon(order.status)}
                          <span
                            className={`text-xs font-medium ${
                              order.status === 'released'
                                ? 'text-nvx-buy'
                                : order.status === 'cancelled'
                                  ? 'text-nvx-sell'
                                  : 'text-nvx-text-secondary'
                            }`}
                          >
                            {order.status}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {order.status === 'pending' && (
                            <>
                              <button
                                onClick={() =>
                                  handleAction(order.id, 'paid')
                                }
                                disabled={actionLoading === order.id}
                                className="px-2 py-1 text-[10px] font-medium rounded bg-nvx-primary/10 text-nvx-primary hover:bg-nvx-primary/20 transition-colors"
                              >
                                {actionLoading === order.id ? (
                                  <Loader2
                                    size={10}
                                    className="animate-spin"
                                  />
                                ) : (
                                  'Mark Paid'
                                )}
                              </button>
                              <button
                                onClick={() =>
                                  handleAction(order.id, 'cancel')
                                }
                                disabled={actionLoading === order.id}
                                className="px-2 py-1 text-[10px] font-medium rounded bg-nvx-sell/10 text-nvx-sell hover:bg-nvx-sell/20 transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {order.status === 'paid' && (
                            <button
                              onClick={() =>
                                handleAction(order.id, 'release')
                              }
                              disabled={actionLoading === order.id}
                              className="px-2 py-1 text-[10px] font-medium rounded bg-nvx-buy/10 text-nvx-buy hover:bg-nvx-buy/20 transition-colors"
                            >
                              {actionLoading === order.id ? (
                                <Loader2
                                  size={10}
                                  className="animate-spin"
                                />
                              ) : (
                                'Release'
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Listing Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl w-full max-w-lg mx-4 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-nvx-text-primary">
                Create P2P Listing
              </h3>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1 rounded hover:bg-nvx-bg-tertiary text-nvx-text-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Type */}
              <div>
                <label className="block text-xs text-nvx-text-muted mb-1">
                  I want to
                </label>
                <div className="flex gap-2">
                  {(['sell', 'buy'] as Tab[]).map((t) => (
                    <button
                      key={t}
                      onClick={() =>
                        setCreateForm((prev) => ({ ...prev, type: t }))
                      }
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        createForm.type === t
                          ? t === 'sell'
                            ? 'bg-nvx-sell text-white'
                            : 'bg-nvx-buy text-white'
                          : 'bg-nvx-bg-primary border border-nvx-border text-nvx-text-secondary'
                      }`}
                    >
                      {t === 'sell' ? 'Sell' : 'Buy'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Asset + Fiat */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-nvx-text-muted mb-1">
                    Asset
                  </label>
                  <select
                    value={createForm.asset}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        asset: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary focus:outline-none focus:border-nvx-primary"
                  >
                    {ASSETS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-nvx-text-muted mb-1">
                    Fiat Currency
                  </label>
                  <select
                    value={createForm.fiatCurrency}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        fiatCurrency: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary focus:outline-none focus:border-nvx-primary"
                  >
                    {FIATS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs text-nvx-text-muted mb-1">
                  Price per {createForm.asset} ({createForm.fiatCurrency})
                </label>
                <input
                  type="number"
                  step="any"
                  value={createForm.price}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, price: e.target.value }))
                  }
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary font-mono"
                />
              </div>

              {/* Min/Max/Total */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-nvx-text-muted mb-1">
                    Min Amount
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={createForm.minAmount}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        minAmount: e.target.value,
                      }))
                    }
                    placeholder="0"
                    className="w-full px-3 py-2.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-nvx-text-muted mb-1">
                    Max Amount
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={createForm.maxAmount}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        maxAmount: e.target.value,
                      }))
                    }
                    placeholder="0"
                    className="w-full px-3 py-2.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-nvx-text-muted mb-1">
                    Total Amount
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={createForm.totalAmount}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        totalAmount: e.target.value,
                      }))
                    }
                    placeholder="0"
                    className="w-full px-3 py-2.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary font-mono"
                  />
                </div>
              </div>

              {/* Payment methods */}
              <div>
                <label className="block text-xs text-nvx-text-muted mb-2">
                  Payment Methods
                </label>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.map((pm) => (
                    <button
                      key={pm}
                      onClick={() => togglePayment(pm)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        createForm.paymentMethods.includes(pm)
                          ? 'bg-nvx-primary text-white'
                          : 'bg-nvx-bg-primary border border-nvx-border text-nvx-text-secondary hover:border-nvx-primary/40'
                      }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {createError && (
              <div className="bg-nvx-sell/10 border border-nvx-sell/30 text-nvx-sell text-xs rounded-lg px-3 py-2 mt-4">
                {createError}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 px-4 rounded-lg border border-nvx-border text-sm font-medium text-nvx-text-secondary hover:bg-nvx-bg-tertiary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateListing}
                disabled={
                  createLoading ||
                  !createForm.price ||
                  !createForm.totalAmount ||
                  createForm.paymentMethods.length === 0
                }
                className="flex-1 py-2.5 px-4 rounded-lg bg-nvx-primary text-white text-sm font-medium hover:bg-nvx-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {createLoading && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                Create Listing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {orderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl w-full max-w-md mx-4 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-nvx-text-primary">
                {tab === 'buy' ? 'Buy' : 'Sell'} {orderModal.asset}
              </h3>
              <button
                onClick={() => setOrderModal(null)}
                className="p-1 rounded hover:bg-nvx-bg-tertiary text-nvx-text-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="bg-nvx-bg-primary rounded-lg p-3">
                <div className="flex justify-between text-xs text-nvx-text-muted mb-1">
                  <span>Price</span>
                  <span className="text-nvx-text-primary font-mono">
                    {parseFloat(orderModal.price).toLocaleString()}{' '}
                    {orderModal.fiatCurrency}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-nvx-text-muted mb-1">
                  <span>Limits</span>
                  <span>
                    {orderModal.minAmount} - {orderModal.maxAmount}{' '}
                    {orderModal.asset}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-nvx-text-muted">
                  <span>Payment</span>
                  <span>{orderModal.paymentMethods.join(', ')}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-nvx-text-muted mb-1">
                  Amount ({orderModal.asset})
                </label>
                <input
                  type="number"
                  step="any"
                  min={orderModal.minAmount}
                  max={orderModal.maxAmount}
                  value={orderAmount}
                  onChange={(e) => setOrderAmount(e.target.value)}
                  placeholder={`${orderModal.minAmount} - ${orderModal.maxAmount}`}
                  className="w-full px-3 py-2.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary font-mono"
                />
              </div>

              {orderAmount && parseFloat(orderAmount) > 0 && (
                <div className="bg-nvx-primary/5 border border-nvx-primary/20 rounded-lg p-3">
                  <p className="text-xs text-nvx-text-muted mb-1">
                    You will {tab === 'buy' ? 'pay' : 'receive'}
                  </p>
                  <p className="text-sm font-mono font-semibold text-nvx-text-primary">
                    {(
                      parseFloat(orderAmount) * parseFloat(orderModal.price)
                    ).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    {orderModal.fiatCurrency}
                  </p>
                </div>
              )}
            </div>

            {orderError && (
              <div className="bg-nvx-sell/10 border border-nvx-sell/30 text-nvx-sell text-xs rounded-lg px-3 py-2 mb-3">
                {orderError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setOrderModal(null)}
                className="flex-1 py-2.5 px-4 rounded-lg border border-nvx-border text-sm font-medium text-nvx-text-secondary hover:bg-nvx-bg-tertiary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={
                  orderLoading ||
                  !orderAmount ||
                  parseFloat(orderAmount) < parseFloat(orderModal.minAmount)
                }
                className={`flex-1 py-2.5 px-4 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  tab === 'buy'
                    ? 'bg-nvx-buy hover:bg-nvx-buy/90'
                    : 'bg-nvx-sell hover:bg-nvx-sell/90'
                }`}
              >
                {orderLoading && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                Confirm {tab === 'buy' ? 'Buy' : 'Sell'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
