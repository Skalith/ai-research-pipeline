import { Report } from '../types';
import { apiClient, downloadAuthenticatedFile } from './client';

export const reportsApi = {
  async getReport(jobId: string): Promise<Report> {
    return apiClient<Report>(`/reports/${encodeURIComponent(jobId)}`, {
      method: 'GET',
    });
  },

  async downloadPdf(jobId: string): Promise<void> {
    const filename = `research-report-${jobId}.pdf`;
    await downloadAuthenticatedFile(`/reports/${encodeURIComponent(jobId)}/download?format=pdf`, filename);
  },

  async downloadDocx(jobId: string): Promise<void> {
    const filename = `research-report-${jobId}.docx`;
    await downloadAuthenticatedFile(`/reports/${encodeURIComponent(jobId)}/download?format=docx`, filename);
  },

  async downloadMarkdown(jobId: string): Promise<{ markdown: string }> {
    // Markdown download returns JSON containing markdown
    const data = await apiClient<{ markdown: string }>(`/reports/${encodeURIComponent(jobId)}/download?format=markdown`, {
      method: 'GET',
    });

    // Also trigger file download in browser
    if (data && typeof data.markdown === 'string') {
      const blob = new Blob([data.markdown], { type: 'text/markdown;charset=utf-8' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `research-report-${jobId}.md`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    }

    return data;
  },
};
