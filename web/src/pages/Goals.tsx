import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { goalQuestion } from '@shared/advisor';
import { getGoalCategory, goalProgress, type Goal } from '@shared/finance';
import { useStore } from '@shared/store';
import { ContributeForm, GoalForm } from '../components/GoalForms';
import { Badge } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, IconButton, ProgressBar } from '../components/ui';
import { fullDate, shortDate, useMoney } from '../hooks';

function GoalCard({ goal, onEdit, onContribute }: { goal: Goal; onEdit: () => void; onContribute: () => void }) {
  const { assets, contributions, removeContribution } = useStore();
  const navigate = useNavigate();
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
    ? { text: 'Đã đạt mục tiêu', cls: 'up' }
    : p.overdue
      ? { text: `Quá hạn ${shortDate(goal.deadline)}`, cls: 'down' }
      : goal.type === 'recurring'
        ? p.contributedThisPeriod
          ? { text: `Đã góp ${p.currentPeriodLabel}`, cls: 'up' }
          : { text: `Chưa góp ${p.currentPeriodLabel}`, cls: 'warn' }
        : { text: `Hạn ${fullDate(goal.deadline)}`, cls: '' };

  return (
    <Card>
      <div className="row">
        <Badge color={cat.color} icon="goals" />
        <span className="grow">
          <span className="strong" style={{ display: 'block', fontSize: 15 }}>{goal.name}</span>
          <span className="caption">
            {cat.label}
            {account ? ` · ${account.name}` : ''}
          </span>
        </span>
        <IconButton icon="edit" label="Sửa mục tiêu" onClick={onEdit} />
      </div>
      <div className="row between">
        <span className="medium num">{format(goal.saved)}</span>
        <span className="label num">/ {format(goal.target)}</span>
      </div>
      <ProgressBar ratio={p.ratio} color={cat.color} />
      <div className="row between wrap">
        <span className={`pill ${status.cls}`}>{status.text}</span>
        <span className="caption num">{Math.round(p.ratio * 100)}% · còn {format(p.remaining)}</span>
      </div>
      {!done ? (
        <span className="label num">
          {goal.type === 'recurring'
            ? `Kế hoạch: ${format(p.periodAmount)} mỗi ${p.periodUnit} · hạn ${fullDate(goal.deadline)}`
            : `Cần để dành khoảng ${format(p.monthlyNeeded)} mỗi tháng (còn ${p.monthsLeft} tháng).`}
        </span>
      ) : null}
      <div className="row wrap">
        {!done ? <Button small icon="plus" label="Góp tiền" onClick={onContribute} /> : null}
        <Button small variant="secondary" icon="sparkle" label="Hỏi AI" onClick={() => navigate('/advisor', { state: { question: goalQuestion(goal) } })} />
        {history.length > 0 ? (
          <Button small variant="ghost" label={showHistory ? 'Ẩn lịch sử' : `Lịch sử góp (${history.length})`} onClick={() => setShowHistory((s) => !s)} />
        ) : null}
      </div>
      {showHistory ? (
        <div className="list">
          {history.map((c) => {
            const from = c.accountId ? assets.find((a) => a.id === c.accountId)?.name : undefined;
            return (
              <div className="item" key={c.id}>
                <span className="grow">
                  <span className="title num" style={{ display: 'block' }}>+{format(c.amount)}</span>
                  <span className="sub" style={{ display: 'block' }}>
                    {fullDate(c.date)}
                    {from ? ` · từ ${from}` : ''}
                  </span>
                </span>
                <IconButton
                  icon="trash"
                  label="Xoá lần góp"
                  onClick={() => {
                    removeContribution(c.id);
                    toast.show({ message: 'Đã xoá lần góp.' });
                  }}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </Card>
  );
}

export function GoalsPage() {
  const { goals } = useStore();
  const format = useMoney();
  const [form, setForm] = useState<{ goal: Goal | null } | null>(null);
  const [contributing, setContributing] = useState<Goal | null>(null);
  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);

  return (
    <>
      {goals.length === 0 ? (
        <Card>
          <EmptyState
            icon="goals"
            title="Chưa có mục tiêu"
            message="Đặt mục tiêu tiết kiệm hoặc kế hoạch góp định kỳ (tuần, tháng, quý) để theo dõi tiến độ."
            actionLabel="Thêm mục tiêu"
            onAction={() => setForm({ goal: null })}
          />
        </Card>
      ) : (
        <>
          <Card>
            <div className="row between">
              <span className="label">Đã tích luỹ cho {goals.length} mục tiêu</span>
              <Button small icon="plus" label="Thêm mục tiêu" onClick={() => setForm({ goal: null })} />
            </div>
            <div className="row between">
              <span className="big num">{format(totalSaved)}</span>
              <span className="label num">/ {format(totalTarget)}</span>
            </div>
            <ProgressBar ratio={totalTarget > 0 ? totalSaved / totalTarget : 0} />
          </Card>
          <div className="grid">
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} onEdit={() => setForm({ goal: g })} onContribute={() => setContributing(g)} />
            ))}
          </div>
        </>
      )}
      {form ? <GoalForm goal={form.goal} onClose={() => setForm(null)} /> : null}
      {contributing ? <ContributeForm goal={contributing} onClose={() => setContributing(null)} /> : null}
    </>
  );
}
