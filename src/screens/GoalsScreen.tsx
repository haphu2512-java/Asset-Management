import { useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { goalQuestion } from '../advisor';
import { walletOptions } from '../components/accounts';
import { DateField } from '../components/DateField';
import { GoalForm } from '../components/GoalForm';
import { type IconName } from '../components/Icon';
import { Chips, Field, Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { AmountInput, Button, Card, CategoryBadge, EmptyState, LinkText, ProgressBar } from '../components/ui';
import { formatDigits, getGoalCategory, goalProgress, parseVndExpression, todayKey, type Goal } from '../finance';
import { haptic } from '../haptics';
import { useNav } from '../nav';
import { usePrefs } from '../prefs';
import { useStore } from '../store';
import { font, useMoney, useTheme } from '../theme';

const shortDate = (date: string) => {
  const [y, m, d] = date.split('-');
  return `${Number(d)}/${Number(m)}/${y}`;
};
const NO_WALLET = 'none';
const HISTORY_LIMIT = 5;

/** Sheet for putting money into a goal, optionally taking it from a wallet. */
function ContributeSheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const { ui } = useTheme();
  const { assets, contribute, removeContribution, contributions } = useStore();
  const { prefs } = usePrefs();
  const toast = useToast();
  const format = useMoney();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayKey());
  const [wallet, setWallet] = useState(NO_WALLET);
  const [error, setError] = useState('');
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  // Prefill each time the sheet opens for a goal.
  if (goal && openedFor !== goal.id) {
    const p = goalProgress(goal);
    setOpenedFor(goal.id);
    setAmount(p.periodAmount > 0 ? formatDigits(Math.min(p.periodAmount, p.remaining || p.periodAmount)) : '');
    setDate(todayKey());
    setWallet(goal.assetId && prefs.lastAccountId && prefs.lastAccountId !== goal.assetId ? prefs.lastAccountId : NO_WALLET);
    setError('');
  }
  if (!goal && openedFor) setOpenedFor(null);

  const target = goal?.assetId ? assets.find((a) => a.id === goal.assetId) : undefined;
  const wallets = walletOptions(assets, wallet).filter((o) => o.id !== goal?.assetId);

  // Read the contributions as they are when Undo is pressed, not as they were when the toast opened.
  const latest = useRef(contributions);
  latest.current = contributions;

  const save = () => {
    if (!goal) return;
    const value = parseVndExpression(amount);
    if (!value || value <= 0) return setError('Số tiền không hợp lệ. Ví dụ: 400k hoặc 2tr.');
    const before = new Set(contributions.map((c) => c.id));
    contribute(goal.id, value, { accountId: wallet === NO_WALLET ? undefined : wallet, date });
    haptic('success');
    onClose();
    toast.show({
      message: `Đã góp ${format(value)} vào "${goal.name}".`,
      tone: 'success',
      actionLabel: 'Hoàn tác',
      onAction: () => {
        // The newest contribution of this goal that was not there before.
        const added = latest.current.find((c) => c.goalId === goal.id && !before.has(c.id));
        if (added) removeContribution(added.id);
      },
    });
  };
  return (
    <Sheet visible={!!goal} title={goal ? `Góp vào "${goal.name}"` : ''} onClose={onClose} onSave={save} saveLabel="Góp" error={error}>
      <Field label="Số tiền" icon="wallet">
        <AmountInput value={amount} onChangeText={setAmount} placeholder="Ví dụ: 400k" autoFocus accessibilityLabel="Số tiền góp" />
      </Field>
      <Field label="Ngày góp" icon="calendar">
        <DateField value={date} onChange={setDate} shortcuts />
      </Field>
      {target ? (
        <Field
          label="Lấy tiền từ ví"
          icon="transfer"
          hint={
            wallet === NO_WALLET
              ? `Chỉ ghi nhận tiến độ, không thay đổi số dư ví nào.`
              : `App sẽ ghi một khoản chuyển từ ví này sang "${target.name}".`
          }
        >
          <Chips options={[{ id: NO_WALLET, label: 'Không trừ ví', icon: null }, ...wallets]} value={wallet} onChange={setWallet} showIcons />
        </Field>
      ) : (
        <Text style={ui.label}>
          Mẹo: gắn mục tiêu với một tài khoản (bấm Sửa) để mỗi lần góp tự chuyển tiền từ ví sang tài khoản đó.
        </Text>
      )}
    </Sheet>
  );
}

function GoalCard({ goal, onEdit, onContribute }: { goal: Goal; onEdit: () => void; onContribute: () => void }) {
  const { colors, ui, tone } = useTheme();
  const { assets, contributions, removeContribution } = useStore();
  const nav = useNav();
  const toast = useToast();
  const format = useMoney();
  const [showHistory, setShowHistory] = useState(false);

  const p = goalProgress(goal);
  const done = p.remaining === 0;
  const cat = getGoalCategory(goal.category);
  const account = goal.assetId ? assets.find((a) => a.id === goal.assetId) : undefined;
  const history = useMemo(
    () => contributions.filter((c) => c.goalId === goal.id).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [contributions, goal.id],
  );

  const status = done
    ? { text: 'Đã đạt mục tiêu', color: colors.income }
    : p.overdue
      ? { text: `Quá hạn ${shortDate(goal.deadline)}`, color: colors.expense }
      : goal.type === 'recurring'
        ? p.contributedThisPeriod
          ? { text: `Đã góp ${p.currentPeriodLabel}`, color: colors.income }
          : { text: `Chưa góp ${p.currentPeriodLabel}`, color: colors.warning }
        : { text: `Hạn ${shortDate(goal.deadline)}`, color: colors.muted };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CategoryBadge icon={cat.icon as IconName} color={cat.color} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={ui.heading}>{goal.name}</Text>
          <Text style={[ui.label, { color: tone(cat.color), fontWeight: '600' }]}>
            {cat.label}
            {account ? ` · ${account.name}` : ''}
          </Text>
        </View>
        <Button small variant="ghost" label="Sửa" icon="edit" onPress={onEdit} accessibilityLabel={`Sửa mục tiêu ${goal.name}`} />
      </View>

      <View style={ui.row}>
        <View>
          <Text style={ui.label}>Đã tích lũy</Text>
          <Text style={{ fontSize: font.title, fontWeight: '800', color: colors.primary }}>{format(goal.saved)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={ui.label}>Mục tiêu</Text>
          <Text style={[ui.text, { fontWeight: '600' }]}>{format(goal.target)}</Text>
        </View>
      </View>
      <ProgressBar
        ratio={p.ratio}
        color={done ? colors.income : colors.primary}
        label={`Đã đạt ${Math.round(p.ratio * 100)} phần trăm mục tiêu ${goal.name}`}
      />
      <View style={ui.row}>
        <Text style={[ui.label, { color: status.color, fontWeight: '600' }]}>{status.text}</Text>
        <Text style={ui.label}>{Math.round(p.ratio * 100)}%</Text>
      </View>

      {!done ? (
        <Text style={ui.text}>
          {goal.type === 'recurring'
            ? `Kế hoạch góp ${format(p.periodAmount)} mỗi ${p.periodUnit}. Còn thiếu ${format(p.remaining)}.`
            : `Còn thiếu ${format(p.remaining)}. Cần để dành khoảng ${format(p.periodAmount)} mỗi ${p.periodUnit} trong ${p.monthsLeft} tháng tới.`}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {!done ? <Button small label="Góp tiền" icon="plus" onPress={onContribute} style={{ flexGrow: 1 }} /> : null}
        <Button
          small
          variant="secondary"
          label="Hỏi AI"
          icon="sparkles"
          onPress={() => nav.push({ name: 'advisor', question: goalQuestion(goal) })}
          style={{ flexGrow: 1 }}
          accessibilityLabel={`Hỏi cố vấn AI về mục tiêu ${goal.name}`}
        />
      </View>

      {history.length > 0 ? (
        <View style={{ gap: 6 }}>
          <LinkText
            label={showHistory ? 'Ẩn lịch sử góp' : `Xem lịch sử góp (${history.length} lần)`}
            onPress={() => setShowHistory((v) => !v)}
          />
          {showHistory
            ? history.slice(0, HISTORY_LIMIT).map((c) => (
                <View key={c.id} style={ui.row}>
                  <Text style={ui.text}>
                    {shortDate(c.date)} · {format(c.amount)}
                    {c.accountId ? ` · từ ${assets.find((a) => a.id === c.accountId)?.name ?? 'ví đã xoá'}` : ''}
                  </Text>
                  <Button
                    small
                    variant="ghost"
                    label="Xoá"
                    accessibilityLabel={`Xoá lần góp ${format(c.amount)} ngày ${shortDate(c.date)}`}
                    onPress={() => {
                      removeContribution(c.id);
                      toast.show({ message: 'Đã xoá lần góp và hoàn lại số dư.', tone: 'neutral' });
                    }}
                  />
                </View>
              ))
            : null}
          {showHistory && history.length > HISTORY_LIMIT ? (
            <Text style={ui.label}>Hiển thị {HISTORY_LIMIT} lần gần nhất.</Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

export function GoalsScreen() {
  const { ui } = useTheme();
  const { goals } = useStore();
  const format = useMoney();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [contributing, setContributing] = useState<Goal | null>(null);

  const sorted = useMemo(
    () =>
      [...goals].sort((a, b) => {
        const da = a.saved >= a.target ? 1 : 0;
        const db = b.saved >= b.target ? 1 : 0;
        return da - db || a.deadline.localeCompare(b.deadline);
      }),
    [goals],
  );
  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);

  const openForm = (goal: Goal | null) => {
    setEditing(goal);
    setFormOpen(true);
  };

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        {goals.length === 0 ? (
          <EmptyState
            icon="goals"
            title="Chưa có mục tiêu nào"
            message="Đặt một mục tiêu như quỹ dự phòng, mua xe hay tích sản ETF. App sẽ tính mỗi kỳ bạn cần để dành bao nhiêu."
            actionLabel="Tạo mục tiêu đầu tiên"
            onAction={() => openForm(null)}
          />
        ) : (
          <>
            <Card>
              <View style={ui.row}>
                <View>
                  <Text style={ui.label}>Tổng đã tích lũy cho {goals.length} mục tiêu</Text>
                  <Text style={ui.big}>{format(totalSaved)}</Text>
                </View>
              </View>
              <ProgressBar ratio={totalTarget > 0 ? totalSaved / totalTarget : 0} label="Tiến độ chung của các mục tiêu" />
              <Text style={ui.label}>trên tổng mục tiêu {format(totalTarget)}</Text>
            </Card>
            {sorted.map((g) => (
              <GoalCard key={g.id} goal={g} onEdit={() => openForm(g)} onContribute={() => setContributing(g)} />
            ))}
            <Button variant="secondary" label="Thêm mục tiêu" icon="plus" onPress={() => openForm(null)} />
          </>
        )}
      </ScrollView>
      <GoalForm visible={formOpen} goal={editing} onClose={() => setFormOpen(false)} />
      <ContributeSheet goal={contributing} onClose={() => setContributing(null)} />
    </View>
  );
}
