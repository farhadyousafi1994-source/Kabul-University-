import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashPassword } from './server.js'

// ---------------------------------------------------------------------------
// KU-AMS development database (SQLite via node:sqlite).
// The schema below mirrors the Laravel migrations of the real backend
// (backend/database/migrations) 1:1 in structure — same tables, columns,
// foreign keys and constraints.
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
mkdirSync(DATA_DIR, { recursive: true })
const DB_PATH = path.join(DATA_DIR, 'ku-ams.sqlite')

const iso = (d) => d.toISOString().slice(0, 10)
const daysAgo = (n) => iso(new Date(Date.now() - n * 86400000))
const daysAhead = (n) => iso(new Date(Date.now() + n * 86400000))

export const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  employee_number TEXT UNIQUE,
  department_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  password_hash TEXT NOT NULL,
  avatar TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  guard_name TEXT NOT NULL DEFAULT 'web',
  created_at TEXT, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  guard_name TEXT NOT NULL DEFAULT 'web',
  created_at TEXT, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS role_user (
  role_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  PRIMARY KEY (role_id, user_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS role_permission (
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT,
  expires_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT, updated_at TEXT, deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS faculties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campus_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  dean TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT, updated_at TEXT, deleted_at TEXT,
  FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  faculty_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  head TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT, updated_at TEXT, deleted_at TEXT,
  FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS buildings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campus_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT, updated_at TEXT, deleted_at TEXT,
  FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS floors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT, updated_at TEXT, deleted_at TEXT,
  FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  floor_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  room_type TEXT NOT NULL DEFAULT 'general',
  capacity INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT, updated_at TEXT, deleted_at TEXT,
  FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS asset_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT, updated_at TEXT, deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS asset_subcategories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT, updated_at TEXT, deleted_at TEXT,
  FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category_id INTEGER NOT NULL,
  subcategory_id INTEGER,
  brand TEXT,
  model TEXT,
  serial_number TEXT UNIQUE,
  barcode TEXT UNIQUE,
  qr_code TEXT UNIQUE,
  purchase_date TEXT,
  purchase_price REAL DEFAULT 0,
  current_value REAL DEFAULT 0,
  salvage_value REAL DEFAULT 0,
  supplier_id INTEGER,
  warranty_expiry_date TEXT,
  useful_life INTEGER DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'available',
  condition TEXT NOT NULL DEFAULT 'good',
  campus_id INTEGER, faculty_id INTEGER, department_id INTEGER,
  building_id INTEGER, floor_id INTEGER, room_id INTEGER,
  created_by INTEGER,
  created_at TEXT, updated_at TEXT, deleted_at TEXT,
  FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (subcategory_id) REFERENCES asset_subcategories(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE SET NULL,
  FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE SET NULL,
  FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE SET NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS asset_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  mime TEXT,
  size INTEGER DEFAULT 0,
  created_by INTEGER,
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS asset_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other',
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  mime TEXT,
  size INTEGER DEFAULT 0,
  created_by INTEGER,
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS asset_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL,
  assigned_to_user_id INTEGER NOT NULL,
  assigned_by INTEGER NOT NULL,
  assigned_date TEXT,
  expected_return_date TEXT,
  returned_date TEXT,
  condition_on_return TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_assignments_asset ON asset_assignments(asset_id, status);

CREATE TABLE IF NOT EXISTS asset_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL,
  from_campus_id INTEGER, from_faculty_id INTEGER, from_department_id INTEGER,
  from_building_id INTEGER, from_floor_id INTEGER, from_room_id INTEGER,
  to_campus_id INTEGER, to_faculty_id INTEGER, to_department_id INTEGER,
  to_building_id INTEGER, to_floor_id INTEGER, to_room_id INTEGER,
  requested_by INTEGER,
  approved_by INTEGER,
  transfer_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS asset_location_histories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL,
  campus_id INTEGER, faculty_id INTEGER, department_id INTEGER,
  building_id INTEGER, floor_id INTEGER, room_id INTEGER,
  moved_by INTEGER,
  moved_at TEXT,
  reason TEXT,
  created_at TEXT,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_loc_history_asset ON asset_location_histories(asset_id, moved_at);

CREATE TABLE IF NOT EXISTS asset_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_number TEXT NOT NULL UNIQUE,
  requester_id INTEGER NOT NULL,
  department_id INTEGER,
  request_type TEXT NOT NULL DEFAULT 'new_asset',
  asset_category_id INTEGER,
  quantity INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (asset_category_id) REFERENCES asset_categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL,
  requested_by INTEGER NOT NULL,
  maintenance_type TEXT NOT NULL DEFAULT 'corrective',
  priority TEXT NOT NULL DEFAULT 'medium',
  problem TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS asset_maintenances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  maintenance_request_id INTEGER,
  asset_id INTEGER NOT NULL,
  technician_id INTEGER,
  maintenance_type TEXT NOT NULL DEFAULT 'corrective',
  scheduled_date TEXT,
  start_date TEXT,
  end_date TEXT,
  cost REAL DEFAULT 0,
  notes TEXT,
  result TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id) ON DELETE SET NULL,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
  FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON asset_maintenances(asset_id, status);

CREATE TABLE IF NOT EXISTS asset_incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL,
  incident_type TEXT NOT NULL,
  description TEXT,
  incident_date TEXT,
  reported_by INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  resolution TEXT,
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
  FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  company_name TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_number TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT, updated_at TEXT, deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_number TEXT NOT NULL UNIQUE,
  requested_by INTEGER NOT NULL,
  department_id INTEGER,
  supplier_id INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT NOT NULL UNIQUE,
  purchase_request_id INTEGER,
  supplier_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  order_date TEXT,
  expected_date TEXT,
  subtotal REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  total REAL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id INTEGER NOT NULL,
  asset_category_id INTEGER,
  name TEXT NOT NULL,
  brand TEXT, model TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  received_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_category_id) REFERENCES asset_categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_number TEXT NOT NULL UNIQUE,
  purchase_order_id INTEGER NOT NULL,
  warehouse_id INTEGER,
  received_by INTEGER,
  received_date TEXT,
  notes TEXT,
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL,
  FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS warehouses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  location TEXT,
  keeper_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT, updated_at TEXT, deleted_at TEXT,
  FOREIGN KEY (keeper_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS warehouse_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL,
  warehouse_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  reference_type TEXT,
  reference_id INTEGER,
  user_id INTEGER,
  notes TEXT,
  created_at TEXT,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS asset_audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_code TEXT NOT NULL UNIQUE,
  auditor_id INTEGER,
  scope_type TEXT,
  scope_id INTEGER,
  scheduled_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  summary TEXT,
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (auditor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS asset_audit_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_audit_id INTEGER NOT NULL,
  asset_id INTEGER NOT NULL,
  scanned_at TEXT,
  verification TEXT,
  notes TEXT,
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (asset_audit_id) REFERENCES asset_audits(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS depreciation_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  formula TEXT,
  rate REAL,
  settings_json TEXT,
  created_at TEXT, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS asset_depreciations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL,
  method_id INTEGER NOT NULL,
  period TEXT NOT NULL,
  original_value REAL NOT NULL,
  salvage_value REAL NOT NULL DEFAULT 0,
  useful_life INTEGER NOT NULL,
  annual_depreciation REAL NOT NULL DEFAULT 0,
  accumulated_depreciation REAL NOT NULL DEFAULT 0,
  book_value REAL NOT NULL DEFAULT 0,
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  FOREIGN KEY (method_id) REFERENCES depreciation_methods(id) ON DELETE RESTRICT,
  UNIQUE (asset_id, period)
);

CREATE TABLE IF NOT EXISTS asset_disposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'sold',
  requested_by INTEGER,
  approved_by INTEGER,
  request_date TEXT,
  approval_date TEXT,
  disposal_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  revenue REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  entity_label TEXT,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  created_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_logs ON activity_logs(created_at, module);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'in_app',
  notifiable_id INTEGER NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  read_at TEXT,
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (notifiable_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  "group" TEXT NOT NULL DEFAULT 'general',
  type TEXT NOT NULL DEFAULT 'string',
  created_at TEXT, updated_at TEXT
);
`

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function insert(db, table, data) {
  const keys = Object.keys(data)
  // Quote identifiers so reserved words (e.g. "group") work as column names,
  // mirroring how Laravel's schema builder quotes identifiers.
  const cols = keys.map((k) => `"${k}"`).join(', ')
  const stmt = db.prepare(
    `INSERT INTO ${table} (${cols}) VALUES (${keys.map(() => '?').join(', ')})`,
  )
  const info = stmt.run(...keys.map((k) => data[k]))
  return Number(info.lastInsertRowid)
}

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seed(db) {
  const now = new Date().toISOString()
  const rnd = mulberry32(20260831)

  // --- Permissions ---------------------------------------------------------
  const PERMISSIONS = [
    'dashboard.view',
    'users.view', 'users.create', 'users.update', 'users.delete',
    'roles.view', 'roles.create', 'roles.update', 'roles.delete',
    'organization.view', 'organization.create', 'organization.update', 'organization.delete',
    'categories.view', 'categories.create', 'categories.update', 'categories.delete',
    'assets.view', 'assets.create', 'assets.update', 'assets.delete',
    'assets.assign', 'assets.return', 'assets.transfer', 'assets.dispose',
    'maintenance.view', 'maintenance.create', 'maintenance.update',
    'incidents.view', 'incidents.create', 'incidents.update',
    'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
    'procurement.view', 'procurement.create', 'procurement.update', 'procurement.approve',
    'warehouse.view', 'warehouse.create', 'warehouse.update', 'warehouse.transfer',
    'audit.view', 'audit.create', 'audit.complete',
    'depreciation.view', 'depreciation.calculate',
    'requests.view', 'requests.create', 'requests.approve',
    'reports.view', 'settings.manage', 'notifications.view',
  ]
  const permIds = {}
  for (const p of PERMISSIONS) {
    permIds[p] = insert(db, 'permissions', { name: p, guard_name: 'web', created_at: now, updated_at: now })
  }

  const ALL = Object.keys(permIds)

  // --- Roles ---------------------------------------------------------------
  const roleDefs = {
    'Super Admin': ALL,
    'University Administrator': ALL,
    'Asset Manager': [
      'dashboard.view', 'categories.view', 'categories.create', 'categories.update',
      'assets.view', 'assets.create', 'assets.update', 'assets.assign', 'assets.return',
      'assets.transfer', 'assets.dispose', 'maintenance.view', 'maintenance.create',
      'maintenance.update', 'incidents.view', 'incidents.create', 'incidents.update',
      'requests.view', 'requests.create', 'requests.approve', 'audit.view',
      'depreciation.view', 'reports.view', 'notifications.view',
    ],
    'Faculty Manager': [
      'dashboard.view', 'assets.view', 'assets.assign', 'assets.return',
      'requests.view', 'requests.create', 'requests.approve',
      'maintenance.view', 'maintenance.create', 'incidents.view', 'incidents.create',
      'reports.view', 'notifications.view',
    ],
    'Department Manager': [
      'dashboard.view', 'assets.view', 'requests.view', 'requests.create',
      'maintenance.view', 'maintenance.create', 'incidents.view', 'incidents.create',
      'notifications.view',
    ],
    'Warehouse Manager': [
      'dashboard.view', 'assets.view', 'assets.create', 'assets.update',
      'warehouse.view', 'warehouse.create', 'warehouse.update', 'warehouse.transfer',
      'procurement.view', 'suppliers.view', 'reports.view', 'notifications.view',
    ],
    'Maintenance Technician': [
      'dashboard.view', 'assets.view', 'maintenance.view', 'maintenance.create',
      'maintenance.update', 'notifications.view',
    ],
    'Auditor': [
      'dashboard.view', 'assets.view', 'audit.view', 'audit.create', 'audit.complete',
      'reports.view', 'notifications.view',
    ],
    'Employee': ['dashboard.view', 'assets.view', 'requests.create', 'notifications.view'],
  }
  const roleIds = {}
  for (const [name, perms] of Object.entries(roleDefs)) {
    const rid = insert(db, 'roles', { name, guard_name: 'web', created_at: now, updated_at: now })
    roleIds[name] = rid
    for (const p of perms) {
      db.prepare('INSERT INTO role_permission (role_id, permission_id) VALUES (?, ?)').run(rid, permIds[p])
    }
  }

  // --- Users ---------------------------------------------------------------
  const userDefs = [
    { name: 'Abdul Rahman Ahmadzai', username: 'superadmin', email: 'superadmin@ku.edu.af', phone: '+93 700 000 001', employee_number: 'KU-0001', role: 'Super Admin' },
    { name: 'Maryam Nazari', username: 'administrator', email: 'admin@ku.edu.af', phone: '+93 700 000 002', employee_number: 'KU-0002', role: 'University Administrator' },
    { name: 'Hassan Karimi', username: 'assetmanager', email: 'assets@ku.edu.af', phone: '+93 700 000 003', employee_number: 'KU-0003', role: 'Asset Manager' },
    { name: 'Sara Rahimi', username: 'facultymanager', email: 'faculty.cs@ku.edu.af', phone: '+93 700 000 004', employee_number: 'KU-0004', role: 'Faculty Manager' },
    { name: 'Omid Stanikzai', username: 'deptmanager', email: 'dept@ku.edu.af', phone: '+93 700 000 005', employee_number: 'KU-0005', role: 'Department Manager' },
    { name: 'Nadia Wahidi', username: 'warehousemanager', email: 'warehouse@ku.edu.af', phone: '+93 700 000 006', employee_number: 'KU-0006', role: 'Warehouse Manager' },
    { name: 'Farid Ahmadi', username: 'technician', email: 'tech@ku.edu.af', phone: '+93 700 000 007', employee_number: 'KU-0007', role: 'Maintenance Technician' },
    { name: 'Zarghona Habibi', username: 'auditor', email: 'audit@ku.edu.af', phone: '+93 700 000 008', employee_number: 'KU-0008', role: 'Auditor' },
    { name: 'Ahmad Farid', username: 'employee', email: 'employee@ku.edu.af', phone: '+93 700 000 009', employee_number: 'KU-0009', role: 'Employee' },
  ]
  const userIds = {}
  for (const u of userDefs) {
    const uid = insert(db, 'users', {
      name: u.name, username: u.username, email: u.email, phone: u.phone,
      employee_number: u.employee_number, status: 'active',
      password_hash: hashPassword('password'),
      created_at: daysAgo(400), updated_at: now,
    })
    userIds[u.username] = uid
    db.prepare('INSERT INTO role_user (role_id, user_id) VALUES (?, ?)').run(roleIds[u.role], uid)
  }

  // --- Organization --------------------------------------------------------
  const campusId = insert(db, 'campuses', {
    code: 'CAMP-MAIN', name: 'Kabul University Main Campus',
    address: 'Jamal Mena, District 3, Kabul, Afghanistan',
    description: 'Main campus of Kabul University', status: 'active',
    created_at: daysAgo(2000), updated_at: now,
  })

  const facultyDefs = [
    ['FAC-CS', 'Faculty of Computer Science', 'CS'],
    ['FAC-ENG', 'Faculty of Engineering', 'ENG'],
    ['FAC-ECO', 'Faculty of Economics', 'ECO'],
    ['FAC-MED', 'Faculty of Medicine', 'MED'],
    ['FAC-LAW', 'Faculty of Law and Political Science', 'LAW'],
    ['FAC-EDU', 'Faculty of Education', 'EDU'],
  ]
  const facultyIds = {}
  for (const [code, name] of facultyDefs) {
    facultyIds[code] = insert(db, 'faculties', { campus_id: campusId, code, name, status: 'active', created_at: daysAgo(1900), updated_at: now })
  }

  const deptDefs = [
    ['FAC-CS', 'DEPT-CS-SW', 'Software Engineering Department'],
    ['FAC-CS', 'DEPT-CS-IS', 'Information Systems Department'],
    ['FAC-ENG', 'DEPT-ENG-CIV', 'Civil Engineering Department'],
    ['FAC-ENG', 'DEPT-ENG-ELEC', 'Electrical Engineering Department'],
    ['FAC-ECO', 'DEPT-ECO-ACC', 'Accounting Department'],
    ['FAC-ECO', 'DEPT-ECO-ECO', 'Economics Department'],
    ['FAC-MED', 'DEPT-MED-BAS', 'Basic Sciences Department'],
    ['FAC-MED', 'DEPT-MED-CLIN', 'Clinical Sciences Department'],
    ['FAC-LAW', 'DEPT-LAW-PUB', 'Public Law Department'],
    ['FAC-EDU', 'DEPT-EDU-SCI', 'Science Education Department'],
  ]
  const deptIds = {}
  for (const [fac, code, name] of deptDefs) {
    deptIds[code] = insert(db, 'departments', { faculty_id: facultyIds[fac], code, name, status: 'active', created_at: daysAgo(1800), updated_at: now })
  }

  const buildingDefs = [
    ['BLD-CS', 'Computer Science Building', 'Offices, labs and classrooms for the Faculty of Computer Science'],
    ['BLD-ENG', 'Engineering Block', 'Engineering faculty facilities'],
    ['BLD-LIB', 'Central Library', 'University central library building'],
    ['BLD-SCI', 'Science Laboratories', 'Shared science laboratory building'],
  ]
  const buildingIds = {}
  for (const [code, name, desc] of buildingDefs) {
    buildingIds[code] = insert(db, 'buildings', { campus_id: campusId, code, name, description: desc, status: 'active', created_at: daysAgo(1700), updated_at: now })
  }

  const floorIds = {}
  for (const bld of buildingDefs) {
    for (let lvl = 1; lvl <= 3; lvl++) {
      const code = `${bld[0]}-F${lvl}`
      floorIds[code] = insert(db, 'floors', { building_id: buildingIds[bld[0]], code, name: `Floor ${lvl}`, level: lvl, status: 'active', created_at: daysAgo(1600), updated_at: now })
    }
  }

  const roomDefs = [
    ['BLD-CS-F1', 'R-CS-101', 'Software Engineering Office', 'office'],
    ['BLD-CS-F1', 'R-CS-102', 'IT Support Office', 'office'],
    ['BLD-CS-F1', 'R-CS-103', 'Computer Lab 1', 'laboratory'],
    ['BLD-CS-F2', 'R-CS-201', 'Computer Lab 2', 'laboratory'],
    ['BLD-CS-F2', 'R-CS-202', 'Networking Lab', 'laboratory'],
    ['BLD-CS-F2', 'R-CS-203', 'Department Office', 'office'],
    ['BLD-CS-F3', 'R-CS-301', 'Dean Office', 'office'],
    ['BLD-CS-F3', 'R-CS-302', 'Classroom 301', 'classroom'],
    ['BLD-ENG-F1', 'R-ENG-101', 'Civil Lab', 'laboratory'],
    ['BLD-ENG-F1', 'R-ENG-102', 'Electrical Lab', 'laboratory'],
    ['BLD-ENG-F2', 'R-ENG-201', 'Engineering Office', 'office'],
    ['BLD-ENG-F2', 'R-ENG-202', 'Drawing Hall', 'classroom'],
    ['BLD-LIB-F1', 'R-LIB-101', 'Reading Hall', 'library'],
    ['BLD-LIB-F1', 'R-LIB-102', 'Reference Section', 'library'],
    ['BLD-LIB-F2', 'R-LIB-201', 'Library Office', 'office'],
    ['BLD-LIB-F2', 'R-LIB-202', 'Digital Library', 'library'],
    ['BLD-SCI-F1', 'R-SCI-101', 'Chemistry Lab', 'laboratory'],
    ['BLD-SCI-F1', 'R-SCI-102', 'Physics Lab', 'laboratory'],
    ['BLD-SCI-F2', 'R-SCI-201', 'Biology Lab', 'laboratory'],
    ['BLD-SCI-F2', 'R-SCI-202', 'Research Lab', 'laboratory'],
    ['BLD-SCI-F3', 'R-SCI-301', 'Science Store', 'warehouse'],
  ]
  const roomIds = {}
  for (const [floor, code, name, type] of roomDefs) {
    roomIds[code] = insert(db, 'rooms', { floor_id: floorIds[floor], code, name, room_type: type, capacity: type === 'classroom' ? 40 : 10, status: 'active', created_at: daysAgo(1500), updated_at: now })
  }

  // Link a couple of users to departments.
  db.prepare('UPDATE users SET department_id = ? WHERE username = ?').run(deptIds['DEPT-CS-SW'], 'deptmanager')
  db.prepare('UPDATE users SET department_id = ? WHERE username = ?').run(deptIds['DEPT-CS-SW'], 'employee')
  db.prepare('UPDATE users SET department_id = ? WHERE username = ?').run(deptIds['DEPT-CS-SW'], 'facultymanager')

  // --- Warehouses ------------------------------------------------------------
  const w1 = insert(db, 'warehouses', { code: 'WH-CENTRAL', name: 'Central Store', location: 'Science Laboratories, Floor 3', keeper_id: userIds.warehousemanager, status: 'active', created_at: daysAgo(900), updated_at: now })
  const w2 = insert(db, 'warehouses', { code: 'WH-IT', name: 'IT Store', location: 'Computer Science Building, Floor 1', keeper_id: userIds.warehousemanager, status: 'active', created_at: daysAgo(700), updated_at: now })

  // --- Suppliers --------------------------------------------------------------
  const supplierDefs = [
    ['SUP-001', 'Kabul Tech Solutions', 'Kabul Tech Solutions Ltd.', 'Haji Wali', '+93 700 111 001', 'sales@kabulttech.af', 'Shahr-e-Naw, Kabul', 'TAX-1001'],
    ['SUP-002', 'Alokozay Trading Co.', 'Alokozay Trading Company', 'Ahmad Zia', '+93 700 111 002', 'info@alokozay.af', 'Darul Aman Road, Kabul', 'TAX-1002'],
    ['SUP-003', 'Darul Aman Scientific Supplies', 'DAS Scientific Co.', 'Dr. Naim', '+93 700 111 003', 'orders@dassci.af', 'Karte-Char, Kabul', 'TAX-1003'],
    ['SUP-004', 'Afghan Motors Ltd.', 'Afghan Motors Ltd.', 'Rahim Gul', '+93 700 111 004', 'sales@afghanmotors.af', 'MacroRayyan, Kabul', 'TAX-1004'],
    ['SUP-005', 'Network Pro Afghanistan', 'Network Pro Co.', 'Javed Sultani', '+93 700 111 005', 'hello@networkpro.af', 'Taimani, Kabul', 'TAX-1005'],
  ]
  const supplierIds = {}
  for (const [code, name, company, contact, phone, email, address, tax] of supplierDefs) {
    supplierIds[code] = insert(db, 'suppliers', { code, name, company_name: company, contact_person: contact, phone, email, address, tax_number: tax, status: 'active', created_at: daysAgo(800), updated_at: now })
  }

  // --- Categories & subcategories ----------------------------------------------
  const catDefs = [
    ['CAT-IT', 'IT Equipment', 'Computers, laptops, printers and peripherals', [
      ['SUB-IT-COMP', 'Computers'],
      ['SUB-IT-PRINT', 'Printers & Peripherals'],
    ]],
    ['CAT-FUR', 'Furniture', 'Desks, chairs, tables and storage furniture', [
      ['SUB-FUR-DESK', 'Desks & Chairs'],
      ['SUB-FUR-STOR', 'Storage & Shelving'],
    ]],
    ['CAT-LAB', 'Laboratory Equipment', 'Scientific instruments and lab apparatus', [
      ['SUB-LAB-CHEM', 'Chemistry Equipment'],
      ['SUB-LAB-PHYS', 'Physics Equipment'],
      ['SUB-LAB-BIO', 'Biology Equipment'],
    ]],
    ['CAT-OFF', 'Office Equipment', 'Projectors, photocopiers and office machines', [
      ['SUB-OFF-PROJ', 'Projectors'],
      ['SUB-OFF-COPY', 'Photocopiers'],
    ]],
    ['CAT-VEH', 'Vehicles', 'University cars and motorcycles', [
      ['SUB-VEH-CAR', 'Cars'],
      ['SUB-VEH-MOTO', 'Motorcycles'],
    ]],
    ['CAT-NET', 'Networking Equipment', 'Switches, routers, access points and cabling', [
      ['SUB-NET-SW', 'Switches & Routers'],
      ['SUB-NET-CAB', 'Cabling & Accessories'],
    ]],
  ]
  const catIds = {} // code -> {id, code}
  const subIds = {} // code -> id
  for (const [code, name, desc, subs] of catDefs) {
    const cid = insert(db, 'asset_categories', { code, name, description: desc, status: 'active', created_at: daysAgo(1200), updated_at: now })
    catIds[code] = { id: cid, code: code.replace('CAT-', '') }
    for (const [scode, sname] of subs) {
      subIds[scode] = insert(db, 'asset_subcategories', { category_id: cid, code: scode, name: sname, status: 'active', created_at: daysAgo(1100), updated_at: now })
    }
  }

  // --- Depreciation method (referenced by asset depreciation rows) --------------
  insert(db, 'depreciation_methods', {
    code: 'SL', name: 'Straight Line',
    formula: '(Purchase Price - Salvage Value) / Useful Life',
    rate: null, settings_json: '{}', created_at: now, updated_at: now,
  })

  // --- Assets ------------------------------------------------------------------
  const catCode = (cid) => catDefs.find(([code]) => catIds[code].id === cid)[0].replace('CAT-', '')
  const seqCounters = {}
  const locs = [
    // [campus, faculty, dept, building, floor, room]
    [campusId, facultyIds['FAC-CS'], deptIds['DEPT-CS-SW'], buildingIds['BLD-CS'], floorIds['BLD-CS-F1'], roomIds['R-CS-103']],
    [campusId, facultyIds['FAC-CS'], deptIds['DEPT-CS-SW'], buildingIds['BLD-CS'], floorIds['BLD-CS-F2'], roomIds['R-CS-201']],
    [campusId, facultyIds['FAC-CS'], deptIds['DEPT-CS-IS'], buildingIds['BLD-CS'], floorIds['BLD-CS-F1'], roomIds['R-CS-102']],
    [campusId, facultyIds['FAC-ENG'], deptIds['DEPT-ENG-ELEC'], buildingIds['BLD-ENG'], floorIds['BLD-ENG-F1'], roomIds['R-ENG-102']],
    [campusId, facultyIds['FAC-ENG'], deptIds['DEPT-ENG-CIV'], buildingIds['BLD-ENG'], floorIds['BLD-ENG-F1'], roomIds['R-ENG-101']],
    [campusId, facultyIds['FAC-MED'], deptIds['DEPT-MED-BAS'], buildingIds['BLD-SCI'], floorIds['BLD-SCI-F1'], roomIds['R-SCI-101']],
    [campusId, facultyIds['FAC-MED'], deptIds['DEPT-MED-BAS'], buildingIds['BLD-SCI'], floorIds['BLD-SCI-F1'], roomIds['R-SCI-102']],
    [campusId, facultyIds['FAC-ECO'], deptIds['DEPT-ECO-ACC'], buildingIds['BLD-LIB'], floorIds['BLD-LIB-F2'], roomIds['R-LIB-201']],
    [campusId, null, null, buildingIds['BLD-LIB'], floorIds['BLD-LIB-F1'], roomIds['R-LIB-101']],
    [campusId, facultyIds['FAC-EDU'], deptIds['DEPT-EDU-SCI'], buildingIds['BLD-LIB'], floorIds['BLD-LIB-F2'], roomIds['R-LIB-202']],
  ]

  const assetDefs = [
    // name, cat, sub, brand, model, price, status, cond, purchaseDaysAgo, warrantyDaysFromPurchase, life, supplier
    ['Dell Latitude 5420 Laptop', 'CAT-IT', 'SUB-IT-COMP', 'Dell', 'Latitude 5420', 95000, 'assigned', 'good', 620, 700, 5, 'SUP-001'],
    ['HP ProBook 450 Laptop', 'CAT-IT', 'SUB-IT-COMP', 'HP', 'ProBook 450 G8', 88000, 'available', 'excellent', 200, 880, 5, 'SUP-001'],
    ['Lenovo ThinkPad T14', 'CAT-IT', 'SUB-IT-COMP', 'Lenovo', 'ThinkPad T14', 102000, 'assigned', 'good', 450, 900, 5, 'SUP-001'],
    ['HP LaserJet Pro M404 Printer', 'CAT-IT', 'SUB-IT-PRINT', 'HP', 'LaserJet Pro M404dn', 32000, 'under_maintenance', 'fair', 700, 365, 5, 'SUP-001'],
    ['Canon PIXMA TS6350 Printer', 'CAT-IT', 'SUB-IT-PRINT', 'Canon', 'PIXMA TS6350', 18000, 'available', 'good', 300, 90, 5, 'SUP-001'],
    ['Desktop PC Intel Core i5', 'CAT-IT', 'SUB-IT-COMP', 'Intel', 'Core i5-12400 / 16GB', 61000, 'available', 'excellent', 120, 840, 5, 'SUP-001'],
    ['Dell OptiPlex 7090 Desktop', 'CAT-IT', 'SUB-IT-COMP', 'Dell', 'OptiPlex 7090', 58000, 'assigned', 'good', 500, 860, 5, 'SUP-001'],
    ['Acer Aspire Desktop', 'CAT-IT', 'SUB-IT-COMP', 'Acer', 'Aspire TC-895', 45000, 'available', 'good', 800, 30, 5, 'SUP-001'],
    ['Samsung 24" Monitor', 'CAT-IT', 'SUB-IT-COMP', 'Samsung', 'S24R350', 14000, 'available', 'excellent', 90, 900, 5, 'SUP-001'],
    ['Executive Office Desk', 'CAT-FUR', 'SUB-FUR-DESK', 'OfficeLine', 'Executive 160', 21000, 'available', 'good', 900, 0, 8, 'SUP-002'],
    ['Ergonomic Office Chair', 'CAT-FUR', 'SUB-FUR-DESK', 'OfficeLine', 'Ergo Plus', 12500, 'assigned', 'fair', 900, 0, 8, 'SUP-002'],
    ['Library Reading Table', 'CAT-FUR', 'SUB-FUR-DESK', 'WoodCraft', 'Reading 240', 26000, 'available', 'good', 1100, 0, 8, 'SUP-002'],
    ['Steel Storage Cabinet', 'CAT-FUR', 'SUB-FUR-STOR', 'SteelPro', 'SC-180', 18500, 'available', 'good', 1000, 0, 8, 'SUP-002'],
    ['Laboratory Microscope', 'CAT-LAB', 'SUB-LAB-BIO', 'Olympus', 'CX23', 145000, 'available', 'excellent', 380, 500, 10, 'SUP-003'],
    ['Analytical Balance', 'CAT-LAB', 'SUB-LAB-CHEM', 'Mettler', 'ME204', 210000, 'under_maintenance', 'good', 700, 200, 10, 'SUP-003'],
    ['Centrifuge Unit', 'CAT-LAB', 'SUB-LAB-BIO', 'Eppendorf', '5804', 260000, 'available', 'good', 600, 400, 10, 'SUP-003'],
    ['Digital Multimeter', 'CAT-LAB', 'SUB-LAB-PHYS', 'Fluke', '115', 24000, 'assigned', 'good', 500, 500, 10, 'SUP-003'],
    ['pH Meter', 'CAT-LAB', 'SUB-LAB-CHEM', 'Hanna', 'HI2211', 32000, 'damaged', 'poor', 750, 0, 10, 'SUP-003'],
    ['Optical Microscope Set', 'CAT-LAB', 'SUB-LAB-BIO', 'Zeiss', 'Primo Star', 320000, 'available', 'excellent', 250, 1000, 10, 'SUP-003'],
    ['Epson EB-X51 Projector', 'CAT-OFF', 'SUB-OFF-PROJ', 'Epson', 'EB-X51', 52000, 'assigned', 'good', 550, 60, 6, 'SUP-002'],
    ['Canon iR2520 Photocopier', 'CAT-OFF', 'SUB-OFF-COPY', 'Canon', 'iR2520', 175000, 'available', 'fair', 950, 45, 6, 'SUP-002'],
    ['BenQ MW535 Projector', 'CAT-OFF', 'SUB-OFF-PROJ', 'BenQ', 'MW535', 48000, 'available', 'good', 400, 700, 6, 'SUP-002'],
    ['Toyota Corolla 2021', 'CAT-VEH', 'SUB-VEH-CAR', 'Toyota', 'Corolla XLi', 1900000, 'assigned', 'good', 750, 100, 12, 'SUP-004'],
    ['Toyota Hilux 2020', 'CAT-VEH', 'SUB-VEH-CAR', 'Toyota', 'Hilux Double Cab', 3200000, 'available', 'good', 1000, 0, 12, 'SUP-004'],
    ['Honda CB150F Motorcycle', 'CAT-VEH', 'SUB-VEH-MOTO', 'Honda', 'CB150F', 185000, 'available', 'good', 500, 300, 12, 'SUP-004'],
    ['Cisco Catalyst 2960 Switch', 'CAT-NET', 'SUB-NET-SW', 'Cisco', 'Catalyst 2960-X', 165000, 'available', 'excellent', 350, 600, 6, 'SUP-005'],
    ['MikroTik RB4011 Router', 'CAT-NET', 'SUB-NET-SW', 'MikroTik', 'RB4011iGS+', 42000, 'assigned', 'good', 280, 700, 6, 'SUP-005'],
    ['Ubiquiti UniFi AP', 'CAT-NET', 'SUB-NET-SW', 'Ubiquiti', 'U6-Lite', 19000, 'available', 'excellent', 150, 800, 6, 'SUP-005'],
    ['Cat6 Cabling Roll 305m', 'CAT-NET', 'SUB-NET-CAB', 'Belden', 'Cat6 UTP', 15000, 'available', 'good', 600, 0, 6, 'SUP-005'],
    ['Dell Latitude 3400 Laptop (Old)', 'CAT-IT', 'SUB-IT-COMP', 'Dell', 'Latitude 3400', 70000, 'retired', 'poor', 1600, 0, 5, 'SUP-001'],
    ['HP LaserJet 1020 Printer (Old)', 'CAT-IT', 'SUB-IT-PRINT', 'HP', 'LaserJet 1020', 20000, 'disposed', 'poor', 2200, 0, 5, 'SUP-001'],
    ['Wooden Office Desk (Old)', 'CAT-FUR', 'SUB-FUR-DESK', 'Local', 'Standard', 9000, 'disposed', 'poor', 2400, 0, 8, 'SUP-002'],
    ['Samsung Galaxy Tablet', 'CAT-IT', 'SUB-IT-COMP', 'Samsung', 'Tab S7', 42000, 'lost', 'good', 480, 600, 5, 'SUP-001'],
    ['Cisco Aironet 1815 AP', 'CAT-NET', 'SUB-NET-SW', 'Cisco', 'Aironet 1815', 28000, 'stolen', 'good', 520, 0, 6, 'SUP-005'],
  ]

  const assetIds = []
  let assetIndex = 0
  for (const def of assetDefs) {
    const [name, cat, sub, brand, model, price, status, cond, purDays, warFromPur, life, sup] = def
    const catCodeShort = catIds[cat].code
    const year = new Date(Date.now() - purDays * 86400000).getFullYear()
    seqCounters[catCodeShort] = (seqCounters[catCodeShort] || 0) + 1
    const assetCode = `KU-${catCodeShort}-${year}-${String(seqCounters[catCodeShort]).padStart(6, '0')}`
    const loc = locs[assetIndex % locs.length]
    const purchaseDate = daysAgo(purDays)
    const warranty = warFromPur ? daysAgo(purDays - warFromPur) : null
    const usefulLife = life
    const purchasePrice = price
    const ageYears = Math.max(0, (Date.now() - new Date(purchaseDate).getTime()) / 31557600000)
    const salvage = Math.round(price * 0.1)
    const annual = (price - salvage) / usefulLife
    const currentValue = Math.max(salvage, Math.round(price - annual * Math.min(ageYears, usefulLife)))
    const serial = `${catCodeShort}-${String(assetIndex + 1).padStart(4, '0')}-${Math.floor(rnd() * 9000 + 1000)}`
    const barcode = String(6270000000000 + (assetIndex + 1) * 977)
    const qrCode = `KUQR-${assetCode.replace(/[^A-Z0-9]/g, '')}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`

    const id = insert(db, 'assets', {
      asset_code: assetCode, name, category_id: catIds[cat].id, subcategory_id: subIds[sub],
      brand, model, serial_number: serial, barcode, qr_code: qrCode,
      purchase_date: purchaseDate, purchase_price: purchasePrice, current_value: currentValue,
      salvage_value: salvage, supplier_id: supplierIds[sup], warranty_expiry_date: warranty,
      useful_life: usefulLife, status, condition: cond,
      campus_id: loc[0], faculty_id: loc[1], department_id: loc[2],
      building_id: loc[3], floor_id: loc[4], room_id: loc[5],
      created_by: userIds.assetmanager,
      created_at: purchaseDate + 'T08:30:00.000Z', updated_at: now,
    })
    assetIds.push(id)

    // Initial location history at purchase.
    insert(db, 'asset_location_histories', {
      asset_id: id, campus_id: loc[0], faculty_id: loc[1], department_id: loc[2],
      building_id: loc[3], floor_id: loc[4], room_id: loc[5],
      moved_by: userIds.assetmanager, moved_at: purchaseDate, reason: 'Initial registration',
      created_at: purchaseDate + 'T08:30:00.000Z',
    })

    // Depreciation history: monthly rows since purchase (up to 24 months).
    const months = Math.min(24, Math.floor(ageYears * 12))
    const pd = new Date(purchaseDate)
    for (let m = 1; m <= months; m++) {
      const d = new Date(pd.getFullYear(), pd.getMonth() + m, 1)
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const acc = annual * (m / 12)
      insert(db, 'asset_depreciations', {
        asset_id: id, method_id: 1, period, original_value: purchasePrice, salvage_value: salvage,
        useful_life: usefulLife, annual_depreciation: Math.round(annual),
        accumulated_depreciation: Math.round(acc), book_value: Math.max(salvage, Math.round(purchasePrice - acc)),
        created_at: now, updated_at: now,
      })
    }
    assetIndex++
  }

  // --- Assignments -------------------------------------------------------------
  const assignmentDefs = [
    // assetIndex, assignedTo, assignedDaysAgo, expectedDaysFromAssigned, returnedDaysAgo(null), condOnReturn, status, notes
    [0, 'employee', 60, 120, null, null, 'active', 'Official laptop for teaching staff'],
    [2, 'deptmanager', 45, 90, null, null, 'active', 'Department head work device'],
    [6, 'facultymanager', 30, 90, null, null, 'active', 'Deanery office desktop'],
    [16, 'technician', 20, 60, null, null, 'active', 'Lab instrument loan'],
    [19, 'deptmanager', 90, 60, 20, 'good', 'returned', 'Projector returned after semester'],
    [22, 'facultymanager', 120, 30, 15, 'good', 'returned', 'Vehicle returned from field trip'],
    [10, 'deptmanager', 25, 180, null, null, 'active', 'Ergonomic chair for department office'],
    [26, 'technician', 10, 90, null, null, 'active', 'Network router for lab setup'],
  ]
  for (const [aIdx, toUser, assignedAgo, expDays, retDays, condRet, status, notes] of assignmentDefs) {
    const assetId = assetIds[aIdx]
    const assignedDate = daysAgo(assignedAgo)
    const expectedReturnDate = daysAgo(assignedAgo - expDays)
    const returnedDate = retDays ? daysAgo(retDays) : null
    insert(db, 'asset_assignments', {
      asset_id: assetId, assigned_to_user_id: userIds[toUser], assigned_by: userIds.assetmanager,
      assigned_date: assignedDate, expected_return_date: expectedReturnDate,
      returned_date: returnedDate, condition_on_return: condRet, status, notes,
      created_at: assignedDate + 'T09:00:00.000Z', updated_at: now,
    })
  }

  // --- Transfers ---------------------------------------------------------------
  const transferDefs = [
    // assetIdx, fromLoc, toLoc, requestedBy, approvedBy, daysAgo, status
    [21, locs[8], locs[0], 'deptmanager', 'assetmanager', 10, 'completed'],   // photocopier → CS building
    [2, locs[0], locs[8], 'facultymanager', 'assetmanager', 3, 'in_transit'], // thinkpad → library
    [8, locs[0], locs[8], 'deptmanager', null, 1, 'approved'],                // monitor → library
  ]
  for (const [aIdx, fromLoc, toLoc, reqUser, appUser, ago, status] of transferDefs) {
    const transferDate = daysAgo(ago)
    insert(db, 'asset_transfers', {
      asset_id: assetIds[aIdx],
      from_campus_id: fromLoc[0], from_faculty_id: fromLoc[1], from_department_id: fromLoc[2],
      from_building_id: fromLoc[3], from_floor_id: fromLoc[4], from_room_id: fromLoc[5],
      to_campus_id: toLoc[0], to_faculty_id: toLoc[1], to_department_id: toLoc[2],
      to_building_id: toLoc[3], to_floor_id: toLoc[4], to_room_id: toLoc[5],
      requested_by: userIds[reqUser], approved_by: appUser ? userIds[appUser] : null,
      transfer_date: transferDate, status, notes: 'Inter-building relocation',
      created_at: transferDate + 'T10:00:00.000Z', updated_at: now,
    })
    if (status === 'completed') {
      insert(db, 'asset_location_histories', {
        asset_id: assetIds[aIdx], campus_id: toLoc[0], faculty_id: toLoc[1], department_id: toLoc[2],
        building_id: toLoc[3], floor_id: toLoc[4], room_id: toLoc[5],
        moved_by: userIds.assetmanager, moved_at: transferDate, reason: 'Asset transfer completed',
        created_at: transferDate + 'T10:05:00.000Z',
      })
    }
  }

  // --- Maintenance -------------------------------------------------------------
  const maintDefs = [
    // assetIdx, type, priority, problem, status, tech, scheduledDaysAgo/start, endDaysAgo, cost
    [3, 'corrective', 'high', 'Printer jam and toner leakage', 'in_progress', 'technician', 4, null, 0],
    [14, 'preventive', 'medium', 'Annual calibration', 'in_progress', 'technician', 2, null, 0],
    [20, 'corrective', 'medium', 'Drum unit replacement', 'completed', 'technician', 60, 45, 8500],
    [17, 'corrective', 'high', 'Display panel crack', 'completed', 'technician', 90, 80, 12000],
    [10, 'preventive', 'low', 'Tighten frame and re-oil castors', 'requested', null, null, null, 0],
    [19, 'preventive', 'low', 'Lamp hours check', 'approved', null, null, null, 0],
  ]
  for (const [aIdx, type, priority, problem, status, tech, startAgo, endAgo, cost] of maintDefs) {
    const mrid = insert(db, 'maintenance_requests', {
      asset_id: assetIds[aIdx], requested_by: userIds.deptmanager, maintenance_type: type,
      priority, problem, status: status === 'requested' || status === 'approved' ? status : 'approved',
      created_at: daysAgo((startAgo || 5) + 1) + 'T08:00:00.000Z', updated_at: now,
    })
    insert(db, 'asset_maintenances', {
      maintenance_request_id: mrid, asset_id: assetIds[aIdx],
      technician_id: tech ? userIds[tech] : null,
      maintenance_type: type, scheduled_date: startAgo ? daysAgo(startAgo) : daysAhead(5),
      start_date: startAgo ? daysAgo(startAgo) : null,
      end_date: endAgo ? daysAgo(endAgo) : null,
      cost, notes: problem, result: endAgo ? 'Completed successfully' : null, status,
      created_at: daysAgo((startAgo || 5) + 1) + 'T08:00:00.000Z', updated_at: now,
    })
  }

  // --- Incidents ---------------------------------------------------------------
  insert(db, 'asset_incidents', {
    asset_id: assetIds[32], incident_type: 'lost', description: 'Tablet missing after laboratory session',
    incident_date: daysAgo(25), reported_by: userIds.deptmanager, status: 'resolved',
    resolution: 'Searched all labs; declared lost after 30 days', created_at: daysAgo(25), updated_at: now,
  })
  insert(db, 'asset_incidents', {
    asset_id: assetIds[33], incident_type: 'stolen', description: 'Access point removed from hallway ceiling',
    incident_date: daysAgo(15), reported_by: userIds.technician, status: 'investigating',
    resolution: null, created_at: daysAgo(15), updated_at: now,
  })
  insert(db, 'asset_incidents', {
    asset_id: assetIds[17], incident_type: 'damaged', description: 'pH meter dropped during practical',
    incident_date: daysAgo(35), reported_by: userIds.facultymanager, status: 'resolved',
    resolution: 'Sent for repair — deemed uneconomical, disposal recommended', created_at: daysAgo(35), updated_at: now,
  })

  // --- Asset requests ------------------------------------------------------------
  insert(db, 'asset_requests', {
    request_number: 'ARQ-2026-0001', requester_id: userIds.deptmanager, department_id: deptIds['DEPT-CS-SW'],
    request_type: 'new_asset', asset_category_id: catIds['CAT-IT'].id, quantity: 5,
    reason: 'New teaching assistants require laptops', status: 'department_approval',
    created_at: daysAgo(3), updated_at: now,
  })
  insert(db, 'asset_requests', {
    request_number: 'ARQ-2026-0002', requester_id: userIds.employee, department_id: deptIds['DEPT-CS-IS'],
    request_type: 'temporary_asset', asset_category_id: catIds['CAT-OFF'].id, quantity: 1,
    reason: 'Semester conference presentation', status: 'submitted',
    created_at: daysAgo(1), updated_at: now,
  })

  // --- Procurement ----------------------------------------------------------------
  const prId = insert(db, 'purchase_requests', {
    pr_number: 'PR-2026-0001', requested_by: userIds.deptmanager, department_id: deptIds['DEPT-CS-SW'],
    supplier_id: supplierIds['SUP-001'], status: 'approved', notes: 'Q3 IT refresh',
    created_at: daysAgo(30), updated_at: now,
  })
  const poId = insert(db, 'purchase_orders', {
    po_number: 'PO-2026-0001', purchase_request_id: prId, supplier_id: supplierIds['SUP-001'],
    status: 'partially_received', order_date: daysAgo(25), expected_date: daysAgo(-5),
    subtotal: 366000, tax: 0, total: 366000, created_by: userIds.assetmanager,
    created_at: daysAgo(25), updated_at: now,
  })
  insert(db, 'purchase_order_items', {
    purchase_order_id: poId, asset_category_id: catIds['CAT-IT'].id, name: 'Dell Latitude 5420 Laptop',
    brand: 'Dell', model: 'Latitude 5420', quantity: 3, unit_price: 95000, received_quantity: 2,
    created_at: daysAgo(25), updated_at: now,
  })
  insert(db, 'purchase_order_items', {
    purchase_order_id: poId, asset_category_id: catIds['CAT-IT'].id, name: 'Samsung 24" Monitor',
    brand: 'Samsung', model: 'S24R350', quantity: 4, unit_price: 14000, received_quantity: 4,
    created_at: daysAgo(25), updated_at: now,
  })
  insert(db, 'purchase_receipts', {
    receipt_number: 'RCV-2026-0001', purchase_order_id: poId, warehouse_id: w2,
    received_by: userIds.warehousemanager, received_date: daysAgo(12), notes: 'Partial delivery — 2 laptops, 4 monitors',
    created_at: daysAgo(12), updated_at: now,
  })
  insert(db, 'warehouse_transactions', {
    asset_id: assetIds[5], warehouse_id: w2, type: 'IN', quantity: 1,
    reference_type: 'purchase_receipt', reference_id: 1, user_id: userIds.warehousemanager,
    notes: 'Received from PO-2026-0001', created_at: daysAgo(12),
  })
  insert(db, 'warehouse_transactions', {
    asset_id: assetIds[8], warehouse_id: w2, type: 'IN', quantity: 1,
    reference_type: 'purchase_receipt', reference_id: 1, user_id: userIds.warehousemanager,
    notes: 'Received from PO-2026-0001', created_at: daysAgo(12),
  })
  insert(db, 'warehouse_transactions', {
    asset_id: assetIds[6], warehouse_id: w2, type: 'OUT', quantity: 1,
    reference_type: 'assignment', reference_id: 3, user_id: userIds.assetmanager,
    notes: 'Issued to deanery', created_at: daysAgo(30),
  })

  // --- Audit -----------------------------------------------------------------------
  const auditId = insert(db, 'asset_audits', {
    audit_code: 'AUD-2026-0001', auditor_id: userIds.auditor, scope_type: 'building', scope_id: buildingIds['BLD-CS'],
    scheduled_at: daysAgo(14), started_at: daysAgo(14), completed_at: daysAgo(10),
    status: 'completed', summary: '10 assets verified, 0 missing, 1 wrong location',
    created_at: daysAgo(15), updated_at: now,
  })
  for (let i = 0; i < 10; i++) {
    insert(db, 'asset_audit_items', {
      asset_audit_id: auditId, asset_id: assetIds[i],
      scanned_at: daysAgo(12) + 'T10:00:00.000Z',
      verification: i === 8 ? 'wrong_location' : 'verified',
      notes: i === 8 ? 'Found in Reading Hall instead of CS building' : null,
      created_at: daysAgo(12), updated_at: now,
    })
  }

  // --- Disposal -----------------------------------------------------------------------
  const dispAsset = assetIds.findIndex((_, i) => assetDefs[i][6] === 'disposed')
  insert(db, 'asset_disposals', {
    asset_id: assetIds[dispAsset], method: 'recycled', requested_by: userIds.assetmanager,
    approved_by: userIds.administrator, request_date: daysAgo(120), approval_date: daysAgo(110),
    disposal_date: daysAgo(100), status: 'completed', revenue: 0,
    notes: 'End-of-life printer recycled through certified e-waste vendor',
    created_at: daysAgo(120), updated_at: now,
  })
  const dispAsset2 = assetIds.findIndex((_, i) => i > dispAsset && assetDefs[i][6] === 'disposed')
  insert(db, 'asset_disposals', {
    asset_id: assetIds[dispAsset2], method: 'donated', requested_by: userIds.assetmanager,
    approved_by: userIds.administrator, request_date: daysAgo(90), approval_date: daysAgo(85),
    disposal_date: daysAgo(80), status: 'completed', revenue: 0,
    notes: 'Donated to provincial school', created_at: daysAgo(90), updated_at: now,
  })

  // --- Activity logs --------------------------------------------------------------------
  const logDefs = [
    ['assigned', 'Assignments', 'Asset', 1, 'Dell Latitude 5420 Laptop', 'assetmanager', 1, 'Assigned to Ahmad Farid'],
    ['returned', 'Assignments', 'Asset', 19, 'Epson EB-X51 Projector', 'assetmanager', 20, 'Returned in good condition'],
    ['transferred', 'Transfers', 'Asset', 21, 'Canon iR2520 Photocopier', 'assetmanager', 10, 'Transferred to CS building'],
    ['maintained', 'Maintenance', 'Asset', 20, 'Canon iR2520 Photocopier', 'technician', 45, 'Drum replacement completed'],
    ['created', 'Assets', 'Asset', 5, 'Desktop PC Intel Core i5', 'assetmanager', 120, 'Asset registered'],
    ['updated', 'Assets', 'Asset', 8, 'Samsung 24" Monitor', 'assetmanager', 90, 'Location updated'],
    ['approved', 'Procurement', 'PurchaseOrder', 1, 'PO-2026-0001', 'administrator', 25, 'Purchase order approved'],
    ['disposed', 'Disposal', 'Asset', 30, 'HP LaserJet 1020 Printer', 'assetmanager', 100, 'Recycled'],
    ['created', 'Audit', 'AssetAudit', 1, 'AUD-2026-0001', 'auditor', 15, 'Audit scheduled'],
    ['completed', 'Audit', 'AssetAudit', 1, 'AUD-2026-0001', 'auditor', 10, 'Audit completed'],
    ['created', 'Requests', 'AssetRequest', 1, 'ARQ-2026-0001', 'deptmanager', 3, 'Request submitted'],
    ['incident', 'Incidents', 'Asset', 33, 'Cisco Aironet 1815 AP', 'technician', 15, 'Stolen reported'],
  ]
  for (const [action, module, entityType, entityId, label, user, agoDays, note] of logDefs) {
    insert(db, 'activity_logs', {
      user_id: userIds[user], action, module, entity_type: entityType, entity_id: entityId,
      entity_label: label, old_values: null, new_values: JSON.stringify({ note }),
      ip_address: '127.0.0.1', created_at: daysAgo(agoDays) + 'T11:00:00.000Z',
    })
  }

  // --- Notifications -----------------------------------------------------------------------
  const notifDefs = [
    [1, 'asset_assigned', 'Asset assigned', 'Dell Latitude 5420 Laptop was assigned to Ahmad Farid.', 'assignment_ind', 1],
    [1, 'maintenance_completed', 'Maintenance completed', 'Drum replacement on Canon iR2520 Photocopier completed.', 'build', 45],
    [1, 'transfer_approved', 'Transfer approved', 'Transfer of Lenovo ThinkPad T14 to the Central Library was approved.', 'swap_horiz', 3],
    [1, 'warranty_expiring', 'Warranty expiring soon', 'Warranty for Acer Aspire Desktop expires in 30 days.', 'verified', 0],
    [1, 'request_approval', 'Approval required', 'Asset request ARQ-2026-0001 awaits your approval.', 'approval', 1],
    [9, 'asset_assigned', 'Asset assigned to you', 'Dell Latitude 5420 Laptop has been assigned to you.', 'assignment_ind', 1],
  ]
  for (const [userId, type, title, message, icon, ago] of notifDefs) {
    insert(db, 'notifications', {
      type, notifiable_id: userId,
      data_json: JSON.stringify({ title, message, icon }),
      created_at: daysAgo(ago) + 'T09:30:00.000Z', updated_at: now,
    })
  }

  // --- Settings ----------------------------------------------------------------------------
  const settingsDefs = [
    ['university_name', 'Kabul University', 'university', 'string'],
    ['university_address', 'Jamal Mena, District 3, Kabul, Afghanistan', 'university', 'string'],
    ['university_phone', '+93 20 220 0555', 'university', 'string'],
    ['university_email', 'info@ku.edu.af', 'university', 'string'],
    ['default_currency', 'AFN', 'system', 'string'],
    ['date_format', 'Y-m-d', 'system', 'string'],
    ['asset_code_format', 'KU-{CATEGORY}-{YEAR}-{NUMBER}', 'asset', 'string'],
    ['default_useful_life', '5', 'asset', 'number'],
    ['pagination', '20', 'system', 'number'],
    ['depreciation_method', 'SL', 'asset', 'string'],
  ]
  for (const [key, value, group, type] of settingsDefs) {
    insert(db, 'settings', { key, value, group, type, created_at: now, updated_at: now })
  }

  db.exec('COMMIT')
}

export function openDb() {
  const db = new DatabaseSync(DB_PATH)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)

  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c
  if (userCount === 0) {
    db.exec('BEGIN')
    try {
      seed(db)
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
  return db
}
