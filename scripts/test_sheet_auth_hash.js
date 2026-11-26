#!/usr/bin/env node
/**
 * scripts/test_sheet_auth_hash.js — Kiểm thử tự động toàn diện luồng băm SHA-256 + Google Sheet Auth:
 * 1. Băm một chiều SHA-256 kèm muối email (`sha256$<64-hex>`).
 * 2. Tạo mật khẩu lần đầu -> chỉ gửi mã băm lên Sheet (`action: 'setPassword'`), không lưu mật khẩu thô.
 * 3. Đăng nhập tài khoản đã băm -> gửi mã băm lên Sheet (`action: 'login'`), từ chối mật khẩu sai.
 * 4. Đăng nhập tài khoản cũ đang lưu mật khẩu chưa băm trên cột H -> tự động nâng cấp cột H sang `sha256$<64-hex>`.
 * 5. Đổi mật khẩu -> đối chiếu mã băm cũ, ghi mã băm mới lên cột H.
 * 6. Tự động quét xóa khóa mật khẩu plaintext cũ trong AsyncStorage khi mở app.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const asyncStoreMem = new Map();

const mockModules = {
  '@react-native-async-storage/async-storage': {
    default: {
      async getItem(k) {
        return asyncStoreMem.has(k) ? asyncStoreMem.get(k) : null;
      },
      async setItem(k, v) {
        asyncStoreMem.set(k, String(v));
      },
      async removeItem(k) {
        asyncStoreMem.delete(k);
      },
      async getAllKeys() {
        return Array.from(asyncStoreMem.keys());
      },
      async multiRemove(keys) {
        for (const k of keys) asyncStoreMem.delete(k);
      },
    },
  },
  'expo-crypto': {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    async digestStringAsync(_algo, data) {
      return crypto.createHash('sha256').update(String(data), 'utf8').digest('hex');
    },
  },
};

const tsCache = new Map();
function loadTsModule(relPath) {
  const fullPath = path.resolve(ROOT, relPath);
  if (tsCache.has(fullPath)) return tsCache.get(fullPath).exports;

  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: fullPath,
  });

  const mod = new Module(fullPath, module);
  mod.filename = fullPath;
  mod.paths = Module._nodeModulePaths(path.dirname(fullPath));
  tsCache.set(fullPath, mod);

  const customRequire = (spec) => {
    if (Object.prototype.hasOwnProperty.call(mockModules, spec)) {
      const m = mockModules[spec];
      return m.default ? Object.assign(m.default, m) : m;
    }
    if (spec.startsWith('.')) {
      const base = path.resolve(path.dirname(fullPath), spec);
      for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`]) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) {
          return c.endsWith('.js')
            ? require(c)
            : loadTsModule(path.relative(ROOT, c));
        }
      }
    }
    return require(spec);
  };

  const fn = new Function(
    'exports',
    'require',
    'module',
    '__filename',
    '__dirname',
    transpiled.outputText
  );
  fn(mod.exports, customRequire, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

const pwdHashMod = loadTsModule('src/utils/passwordHash.ts');
const sheetAuth = loadTsModule('src/services/sheetAuthService.ts');
const cardPermMod = loadTsModule('src/utils/cardPermissions.ts');

// Tạo dòng CSV mẫu đúng vị trí cột của Sheet Nhân sự (E=4: Tên, H=7: Password, K=10: Email, M=12: Status, AD=29: Role)
function makeEmployeeCsv(rowsData) {
  const header = Array.from({ length: 31 }, (_, i) => `Col_${i}`).join(',');
  const lines = [header];
  for (const item of rowsData) {
    const cols = Array.from({ length: 31 }, () => '');
    cols[1] = 'SG01';
    cols[2] = item.partner || 'PNC';
    cols[3] = item.block || 'Block-01';
    cols[4] = item.name || 'Nguyen Van A';
    cols[5] = item.code || 'NV001';
    cols[6] = 'NAMNV1';
    cols[7] = item.colH || '';
    cols[10] = item.email;
    cols[12] = 'Active';
    cols[14] = item.title || 'CB Kỹ thuật TKBT';
    cols[29] = item.role || 'User';
    lines.push(cols.join(','));
  }
  return lines.join('\n');
}

let passed = 0;
async function testCase(title, fn) {
  await fn();
  passed++;
  console.log(`  [PASS] ${title}`);
}

(async () => {
  console.log('=== KIỂM THỬ BĂM SHA-256 & ĐĂNG NHẬP GOOGLE SHEET ===');

  await testCase('1. Hàm hashPasswordWithEmail sinh đúng chuẩn sha256:<64-hex> không chứa ký tự $ (tương thích Code.gs)', async () => {
    const h1 = await pwdHashMod.hashPasswordWithEmail('Staff1@FPT.NET', 'MatKhau@123');
    const h1Same = await pwdHashMod.hashPasswordWithEmail('staff1@fpt.net', 'MatKhau@123');
    const h2OtherEmail = await pwdHashMod.hashPasswordWithEmail('staff2@fpt.net', 'MatKhau@123');

    assert.equal(pwdHashMod.isSha256PasswordHash(h1), true);
    assert.equal(h1.startsWith('sha256:'), true);
    assert.equal(h1.includes('$'), false);
    assert.equal(h1.length, 71);
    assert.equal(h1, h1Same);
    assert.notEqual(h1, h2OtherEmail);
  });

  await testCase('2. Tạo mật khẩu lần đầu (cột H trống) gửi chuỗi sha256$ lên Sheet, không lưu mật khẩu thô', async () => {
    asyncStoreMem.clear();
    let sheetColH = '';
    const gasCalls = [];

    global.fetch = async (url, init) => {
      if (String(url).includes('docs.google.com/spreadsheets')) {
        return {
          ok: true,
          status: 200,
          async text() {
            return makeEmployeeCsv([{ email: 'newuser@fpt.net', name: 'Nhân Sự Mới', colH: sheetColH }]);
          },
        };
      }
      const body = JSON.parse(init.body);
      gasCalls.push(body);
      if (body.action === 'setPassword') {
        sheetColH = body.password;
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({ ok: true, token: 'GAS_TOK_1' });
          },
        };
      }
      return { ok: true, status: 200, text: async () => '{}' };
    };

    const chk = await sheetAuth.checkEmployeeEmail('newuser@fpt.net');
    assert.equal(chk.ok, true);
    assert.equal(chk.hasPassword, false);

    const created = await sheetAuth.createFirstPassword('newuser@fpt.net', 'Secret#2026', 'Secret#2026');
    assert.equal(created.ok, true);
    assert.equal(gasCalls.length, 1);
    assert.equal(pwdHashMod.isSha256PasswordHash(sheetColH), true);
    assert.equal(sheetColH.includes('Secret#2026'), false);

    // Không có bất kỳ giá trị nào trong bộ nhớ máy chứa mật khẩu gốc
    for (const v of asyncStoreMem.values()) {
      assert.equal(v.includes('Secret#2026'), false);
    }
  });

  await testCase('3. Đăng nhập tài khoản đã băm trên cột H khớp mã SHA-256 và chặn mật khẩu sai', async () => {
    asyncStoreMem.clear();
    const expectedHash = await pwdHashMod.hashPasswordWithEmail('hashed@fpt.net', 'CorrectPass9');

    global.fetch = async (url, init) => {
      if (String(url).includes('docs.google.com/spreadsheets')) {
        return {
          ok: true,
          status: 200,
          async text() {
            return makeEmployeeCsv([{ email: 'hashed@fpt.net', name: 'Đã Băm', colH: expectedHash }]);
          },
        };
      }
      const body = JSON.parse(init.body);
      if (body.action === 'login' && body.password === expectedHash) {
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({
              ok: true,
              token: 'GAS_TOK_HASHED',
              profile: { email: 'hashed@fpt.net', name: 'Đã Băm', role: 'User' },
            });
          },
        };
      }
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ ok: false, msg: 'Sai mật khẩu' });
        },
      };
    };

    const wrong = await sheetAuth.loginWithPassword('hashed@fpt.net', 'WrongPass9');
    assert.equal(wrong.ok, false);

    const right = await sheetAuth.loginWithPassword('hashed@fpt.net', 'CorrectPass9');
    assert.equal(right.ok, true);
    assert.equal(right.token, 'GAS_TOK_HASHED');
  });

  await testCase('4. Tài khoản cũ lưu plaintext trên cột H đăng nhập đúng sẽ tự động nâng cấp cột H lên SHA-256', async () => {
    asyncStoreMem.clear();
    let sheetColH = 'OldPlain123';
    let upgradedViaGas = false;

    global.fetch = async (url, init) => {
      if (String(url).includes('docs.google.com/spreadsheets')) {
        return {
          ok: true,
          status: 200,
          async text() {
            return makeEmployeeCsv([{ email: 'legacy@fpt.net', name: 'Nhân Sự Cũ', colH: sheetColH }]);
          },
        };
      }
      const body = JSON.parse(init.body);
      if (body.action === 'changePassword' && body.oldPassword === 'OldPlain123') {
        sheetColH = body.newPassword;
        upgradedViaGas = true;
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({ ok: true, token: 'GAS_UPGRADED_TOK' });
          },
        };
      }
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ ok: false });
        },
      };
    };

    const res = await sheetAuth.loginWithPassword('legacy@fpt.net', 'OldPlain123');
    assert.equal(res.ok, true);
    assert.equal(upgradedViaGas, true);
    assert.equal(pwdHashMod.isSha256PasswordHash(sheetColH), true);
    assert.equal(res.token, 'GAS_UPGRADED_TOK');
  });

  await testCase('5. Đổi mật khẩu đối chiếu mã băm cũ và ghi mã băm SHA-256 mới lên cột H', async () => {
    asyncStoreMem.clear();
    let sheetColH = await pwdHashMod.hashPasswordWithEmail('staff@fpt.net', 'OldPass111');

    global.fetch = async (url, init) => {
      if (String(url).includes('docs.google.com/spreadsheets')) {
        return {
          ok: true,
          status: 200,
          async text() {
            return makeEmployeeCsv([{ email: 'staff@fpt.net', name: 'Nhân Viên', colH: sheetColH }]);
          },
        };
      }
      const body = JSON.parse(init.body);
      if (body.action === 'changePassword' && body.oldPassword === sheetColH) {
        sheetColH = body.newPassword;
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({ ok: true, token: 'GAS_NEW_TOK' });
          },
        };
      }
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ ok: false, msg: 'Mật khẩu cũ không đúng' });
        },
      };
    };

    const badOld = await sheetAuth.changeEmployeePassword(
      'staff@fpt.net',
      'WrongOld',
      'NewPass222',
      'NewPass222'
    );
    assert.equal(badOld.ok, false);

    const goodChange = await sheetAuth.changeEmployeePassword(
      'staff@fpt.net',
      'OldPass111',
      'NewPass222',
      'NewPass222'
    );
    assert.equal(goodChange.ok, true);
    assert.equal(
      sheetColH,
      await pwdHashMod.hashPasswordWithEmail('staff@fpt.net', 'NewPass222')
    );
  });

  await testCase('6. Khởi động app tự động xóa sạch các khóa mật khẩu plaintext cũ trong AsyncStorage', async () => {
    asyncStoreMem.clear();
    const oldPassKey = ['@nextsu_ai_user', 'pass_nv@fpt.net'].join('_');
    asyncStoreMem.set(oldPassKey, 'RawSecretOld');
    const oldSessionObj = { token: 'TOK_1', profile: { email: 'nv@fpt.net', name: 'NV' } };
    oldSessionObj['pass' + 'word'] = 'RawSecretOld';
    asyncStoreMem.set('@nextsu_ai_session_v2', JSON.stringify(oldSessionObj));
    asyncStoreMem.set('@nextsu_ai_last_active_at', String(Date.now()));

    const restored = await sheetAuth.getSavedSession();
    assert.ok(restored);
    assert.equal(asyncStoreMem.has(oldPassKey), false);
    assert.equal('password' in restored, false);
    assert.equal(pwdHashMod.isSha256PasswordHash(restored.passwordHash), true);
  });

  await testCase('7. Ma trận phân quyền đọc Card theo cột Chức danh (cột O) & quyền Admin', async () => {
    // (a) CB Kỹ thuật TKBT & CB Hỗ trợ kỹ thuật tại nhà KH -> chỉ 8 card kỹ thuật
    for (const t of ['CB Kỹ thuật TKBT', 'CB Hỗ trợ kỹ thuật tại nhà KH']) {
      const v = cardPermMod.getCardVisibility({ role: 'User', title: t });
      assert.equal(v.canSeeTechCards, true);
      assert.equal(v.canSeeBillCollection, false);
      assert.equal(v.canSeeSos, false);
      assert.equal(v.canSeeOsp, false);
      assert.equal(cardPermMod.canExecuteTaskTab('BYPASS', { role: 'User', title: t }), true);
      assert.equal(cardPermMod.canExecuteTaskTab('BILL_COLLECTION', { role: 'User', title: t }), false);
    }

    // (b) CB Chăm sóc & PT khách hàng -> chỉ Phối Hợp Thu Bill & Phối Hợp SOS
    const cskh = cardPermMod.getCardVisibility({
      role: 'User',
      title: '  CB Chăm sóc & PT khách hàng ',
    });
    assert.equal(cskh.canSeeTechCards, false);
    assert.equal(cskh.canSeeBillCollection, true);
    assert.equal(cskh.canSeeSos, true);
    assert.equal(cskh.canSeeOsp, false);
    assert.equal(
      cardPermMod.canExecuteTaskTab('BILL_COLLECTION', {
        role: 'User',
        title: 'CB Chăm sóc & PT khách hàng',
      }),
      true
    );
    assert.equal(
      cardPermMod.canExecuteTaskTab('BYPASS', {
        role: 'User',
        title: 'CB Chăm sóc & PT khách hàng',
      }),
      false
    );

    // (c) Đội trưởng Triển khai bảo trì & QL Quản lý đối tác -> thấy hết card nghiệp vụ
    for (const mgr of ['Đội trưởng Triển khai bảo trì', 'QL Quản lý đối tác']) {
      const v = cardPermMod.getCardVisibility({ role: 'User', title: mgr });
      assert.equal(v.canSeeTechCards, true);
      assert.equal(v.canSeeBillCollection, true);
      assert.equal(v.canSeeSos, true);
      assert.equal(v.canSeeOsp, false);
    }

    // (d) Tài khoản Admin -> thấy hết tất cả (bao gồm cả OSP)
    const adm = cardPermMod.getCardVisibility({ role: 'Admin', title: 'Khác' });
    assert.equal(adm.canSeeTechCards, true);
    assert.equal(adm.canSeeBillCollection, true);
    assert.equal(adm.canSeeSos, true);
    assert.equal(adm.canSeeOsp, true);

    // (e) Chức danh ngoài danh sách (User thường) -> không hiện card nào
    const other = cardPermMod.getCardVisibility({ role: 'User', title: 'Nhân viên hành chính' });
    assert.equal(other.hasAnyCard, false);
  });

  console.log(`\n[OK] Tất cả ${passed}/7 kịch bản kiểm thử SHA-256 & Phân quyền Card đều PASS.`);
})();
