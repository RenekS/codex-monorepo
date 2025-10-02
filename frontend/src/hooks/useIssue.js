// =============================================================
// File: src/hooks/useIssue.js
// =============================================================
import { useState } from 'react';
import { postEnsureIssue } from '../services/wmsApi';

export default function useIssue(orderNumber) {
  const [issueId, setIssueId] = useState(null);
  const [issueDocNo, setIssueDocNo] = useState(null);

  const ensureIssue = async () => {
    if (issueId) return { issueId, docNo: issueDocNo };
    const data = await postEnsureIssue(orderNumber);
    if (data?.ok && data?.issueId) {
      setIssueId(data.issueId);
      setIssueDocNo(data.docNo || null);
      return { issueId: data.issueId, docNo: data.docNo || null };
    }
    throw new Error(data?.error || 'Nelze založit výdejku');
  };

  return { issueId, issueDocNo, ensureIssue };
}
