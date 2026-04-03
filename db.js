/* ================================================================
   WarehouseHub — Shared Database Layer
   All tool state syncs through Supabase so the whole team
   sees the same data in real-time.
   ================================================================ */

const db = {
  _email: null,
  _sb: null,

  /* Called once after auth guard confirms the session */
  init(supabaseClient, userEmail) {
    this._sb    = supabaseClient;
    this._email = userEmail;
  },

  /* ── SCAN LOG ─────────────────────────────────────────────────
     WMS Scanner, Invoice Scanner, O'Reilly Scanner
     Each scan is a row; the UI rebuilds from today's rows.
  ──────────────────────────────────────────────────────────── */

  async loadScans(tool) {
    if (!this._sb) return [];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data, error } = await this._sb
      .from('scan_log')
      .select('*')
      .eq('tool', tool)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: true });
    if (error) console.error('loadScans:', error);
    return data || [];
  },

  async addScan(tool, { productCode, warehouseLocation, invoiceNumber = null, qty = 1 }) {
    if (!this._sb) return;
    const { error } = await this._sb.from('scan_log').insert({
      tool,
      scanned_by:        this._email,
      product_code:      productCode,
      warehouse_location: warehouseLocation,
      invoice_number:    invoiceNumber,
      qty
    });
    if (error) console.error('addScan:', error);
  },

  async undoLastScan(tool) {
    if (!this._sb) return;
    /* Delete the most recently inserted row for this tool today */
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await this._sb
      .from('scan_log')
      .select('id')
      .eq('tool', tool)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    if (data && data[0]) {
      await this._sb.from('scan_log').delete().eq('id', data[0].id);
    }
  },

  async clearScans(tool) {
    if (!this._sb) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { error } = await this._sb
      .from('scan_log')
      .delete()
      .eq('tool', tool)
      .gte('created_at', todayStart.toISOString());
    if (error) console.error('clearScans:', error);
  },

  /* Convert scan_log rows back into the legacy in-memory shape */
  scanRowsToBoxes(rows) {
    return rows.map(r => ({
      productCode:      r.product_code,
      warehouseLocation: r.warehouse_location,
      invoiceNumber:    r.invoice_number,
      qty:              r.qty
    }));
  },

  /* ── PICK LISTS ───────────────────────────────────────────────
     Order Picker, O'Reilly Picker, DSD Tracker
     One row per tool (UNIQUE constraint on tool column).
     Office uploads parts → everyone can pick.
  ──────────────────────────────────────────────────────────── */

  async loadPickList(tool) {
    if (!this._sb) return null;
    const { data, error } = await this._sb
      .from('pick_lists')
      .select('*')
      .eq('tool', tool)
      .maybeSingle();
    if (error) console.error('loadPickList:', error);
    return data;
  },

  async savePickList(tool, parts, pickedParts) {
    if (!this._sb) return;
    const { error } = await this._sb
      .from('pick_lists')
      .upsert(
        {
          tool,
          parts,
          picked_parts: pickedParts,
          uploaded_by:  this._email,
          updated_at:   new Date().toISOString()
        },
        { onConflict: 'tool' }
      );
    if (error) console.error('savePickList:', error);
  },

  /* ── PROGRESS TRACKER ─────────────────────────────────────────
     Single shared row (id = 1).
     Office uploads order files → warehouse scans parts.
     Everyone sees live progress.
  ──────────────────────────────────────────────────────────── */

  async loadPTSession() {
    if (!this._sb) return null;
    const { data, error } = await this._sb
      .from('pt_session')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error) console.error('loadPTSession:', error);
    return data;
  },

  async savePTSession(orders, pallets) {
    if (!this._sb) return;
    const { error } = await this._sb
      .from('pt_session')
      .upsert(
        {
          id:          1,
          orders,
          pallets,
          uploaded_by: this._email,
          updated_at:  new Date().toISOString()
        },
        { onConflict: 'id' }
      );
    if (error) console.error('savePTSession:', error);
  },

  /* ── REALTIME SUBSCRIPTIONS ───────────────────────────────────
     Each subscribe* returns the channel so callers can
     call channel.unsubscribe() if needed.
  ──────────────────────────────────────────────────────────── */

  subscribeScanLog(tool, callback) {
    if (!this._sb) return null;
    return this._sb
      .channel(`scan_log_${tool}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'scan_log', filter: `tool=eq.${tool}` },
        callback)
      .subscribe();
  },

  subscribePickList(tool, callback) {
    if (!this._sb) return null;
    return this._sb
      .channel(`pick_list_${tool}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pick_lists', filter: `tool=eq.${tool}` },
        callback)
      .subscribe();
  },

  subscribePTSession(callback) {
    if (!this._sb) return null;
    return this._sb
      .channel('pt_session_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pt_session' },
        callback)
      .subscribe();
  },

  /* ── LABEL MAKER ──────────────────────────────────────────────
     Singleton row (id=1) stores the full csvData array and
     queue so every user works from the same uploaded file.
  ──────────────────────────────────────────────────────────── */

  async loadLabelMaker() {
    if (!this._sb) return null;
    const { data, error } = await this._sb
      .from('label_maker')
      .select('csv_data, queue, printed')
      .eq('id', 1)
      .maybeSingle();
    if (error) { console.error('loadLabelMaker:', error); return null; }
    return data;
  },

  async saveLabelMaker(csvData, queue, printed) {
    if (!this._sb) return;
    const { error } = await this._sb.from('label_maker').upsert(
      { id: 1, csv_data: csvData, queue, printed: printed || [], uploaded_by: this._email, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
    if (error) console.error('saveLabelMaker:', error);
  },

  subscribeLabelMaker(callback) {
    if (!this._sb) return null;
    return this._sb
      .channel('label_maker_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'label_maker' },
        callback)
      .subscribe();
  }
};
