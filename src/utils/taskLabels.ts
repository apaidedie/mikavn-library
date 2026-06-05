export function taskLabel(taskType: string) {
  if (taskType === 'metadata.batch_match') return '批量元数据匹配';
  if (taskType === 'metadata.description_image_repair') return '简介图片修复';
  if (taskType === 'metadata.artwork_repair') return '媒体图片补全';
  if (taskType === 'metadata.duplicate_id_audit') return '重复 ID 审查';
  if (taskType === 'library.scan') return '目录扫描';
  if (taskType === 'database.backup') return '数据库备份';
  if (taskType === 'database.restore') return '数据库恢复';
  if (taskType === 'library.archive_export') return '库归档导出';
  if (taskType === 'library.archive_import') return '库归档导入';
  if (taskType === 'library.archive_restore') return '库归档完整恢复';
  if (taskType === 'report.export_markdown') return '报告导出';
  if (taskType === 'game.path_check') return '路径检查';
  if (taskType === 'save.backup') return '存档备份';
  if (taskType === 'save.auto_backup') return '自动存档备份';
  if (taskType === 'save.restore') return '存档恢复';
  return taskType;
}

export function taskStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: '等待中',
    running: '运行中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  };
  return labels[status] ?? status;
}

export function taskStatusClass(status: string) {
  if (status === 'failed') return 'border-rose-300/20 bg-rose-400/10 text-rose-100';
  if (status === 'cancelled') return 'border-amber-300/20 bg-amber-400/10 text-amber-100';
  if (status === 'running' || status === 'pending') return 'border-[rgb(var(--accent-rgb)/0.25)] bg-[rgb(var(--accent-rgb)/0.12)] text-slate-100';
  if (status === 'completed') return 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100';
  return '';
}
