import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { db } from '../firebase';
import { formatDate, formatMoney } from '../lib/format';
import { useCategoryMap } from '../lib/useCategoryMap';
import StatusBadge from '../components/StatusBadge';
import BookingDetailModal from '../components/BookingDetailModal';
import type { Booking, BookingStatus } from '../lib/types';

const columnHelper = createColumnHelper<Booking>();

const STATUS_FILTERS: { key: 'all' | BookingStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'declined', label: 'Declined' },
  { key: 'reschedule_pending', label: 'Reschedule Requested' },
];

export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const categoryMap = useCategoryMap();

  useEffect(() => {
    getDocs(query(collection(db, 'bookings'), orderBy('createdAt', 'desc'))).then((snap) => {
      setBookings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) })));
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(
    () => (statusFilter === 'all' ? bookings : bookings.filter((b) => b.status === statusFilter)),
    [bookings, statusFilter],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('customerName', { header: 'Customer' }),
      columnHelper.accessor('providerName', { header: 'Provider' }),
      columnHelper.accessor('serviceName', { header: 'Service' }),
      columnHelper.accessor('categoryId', {
        header: 'Category',
        cell: (info) => categoryMap[info.getValue()] ?? info.getValue(),
      }),
      columnHelper.accessor('price', {
        header: 'Price',
        cell: (info) => formatMoney(info.getValue() ?? 0),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor('scheduledDate', {
        header: 'Date',
        cell: (info) => formatDate(info.getValue(), info.row.original.scheduledTime),
      }),
    ],
    [categoryMap],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return <div className="page-loading">Loading bookings…</div>;
  }

  return (
    <div className="page">
      <div className="page-header-row">
        <h1 className="page-title">Bookings</h1>
        <span className="count-badge">
          {filtered.length} of {bookings.length}
        </span>
      </div>

      <div className="filter-row">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`filter-chip${statusFilter === f.key ? ' active' : ''}`}
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="table-card">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="clickable-row"
                onClick={() => setSelectedBooking(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="empty-row">
                  No bookings found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdated={(updated) => {
            setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
            setSelectedBooking(updated);
          }}
        />
      )}
    </div>
  );
}
