import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExcelUpload from './ExcelUpload';

// Mock the admin API
jest.mock('../../services/api', () => ({
  adminApi: {
    downloadExcelTemplate: jest.fn(),
    uploadExcel: jest.fn()
  }
}));

import { adminApi } from '../../services/api';
const mockAdminApi = adminApi as jest.Mocked<typeof adminApi>;

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock URL.createObjectURL and revokeObjectURL
Object.defineProperty(window.URL, 'createObjectURL', {
  value: jest.fn(() => 'mocked-url')
});

Object.defineProperty(window.URL, 'revokeObjectURL', {
  value: jest.fn()
});

describe('ExcelUpload Component', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('renders the upload section correctly', () => {
      render(<ExcelUpload />);
      
      expect(screen.getByText('Excel Loan Updates')).toBeInTheDocument();
      expect(screen.getByText('Bulk Loan Balance Updates')).toBeInTheDocument();
      expect(screen.getByText('Download Template')).toBeInTheDocument();
      expect(screen.getByText('Upload Excel File')).toBeInTheDocument();
    });

    it('renders instructions button', () => {
      render(<ExcelUpload />);
      
      expect(screen.getByText('Instructions')).toBeInTheDocument();
    });

    it('shows empty recent updates table initially', () => {
      render(<ExcelUpload />);
      
      expect(screen.getByText('Recent Loan Updates')).toBeInTheDocument();
      expect(screen.getByText('No recent updates. Upload an Excel file to see updated loan accounts here.')).toBeInTheDocument();
    });
  });

  describe('Instructions Dialog', () => {
    it('opens instructions dialog', async () => {
      render(<ExcelUpload />);
      
      // Open instructions
      fireEvent.click(screen.getByText('Instructions'));
      
      await waitFor(() => {
        expect(screen.getByText('Excel Upload Instructions')).toBeInTheDocument();
        expect(screen.getByText('How to Use Excel Upload')).toBeInTheDocument();
        expect(screen.getByText('Required Excel Format')).toBeInTheDocument();
      });
    });

    it('shows no emojis in instructions', async () => {
      render(<ExcelUpload />);
      
      fireEvent.click(screen.getByText('Instructions'));
      
      await waitFor(() => {
        // Check that instruction text doesn't contain common emojis
        const instructionContent = screen.getByText('How to Use Excel Upload');
        expect(instructionContent.textContent).not.toMatch(/📊|📋|📝|⚠️|✅/);
      });
    });
  });

  describe('Template Download', () => {
    it('downloads template successfully', async () => {
      const mockBlob = new Blob(['mock excel data'], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      mockAdminApi.downloadExcelTemplate.mockResolvedValue(mockBlob);

      // Mock DOM methods for file download
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn()
      };
      const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation();
      const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation();

      render(<ExcelUpload />);
      
      fireEvent.click(screen.getByText('Download Template'));
      
      await waitFor(() => {
        expect(createElementSpy).toHaveBeenCalledWith('a');
        expect(mockLink.download).toBe('loan_update_template.xlsx');
        expect(mockLink.click).toHaveBeenCalled();
      });

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('handles template download error', async () => {
      mockAdminApi.downloadExcelTemplate.mockRejectedValue(new Error('Server error'));

      render(<ExcelUpload />);
      
      fireEvent.click(screen.getByText('Download Template'));
      
      await waitFor(() => {
        expect(screen.getByText('Failed to download template. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('File Upload', () => {
    it('validates file type', async () => {
      render(<ExcelUpload />);
      
      const fileInput = screen.getByRole('button', { name: /upload excel file/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        writable: false,
      });
      
      fireEvent.change(fileInput);
      
      await waitFor(() => {
        expect(screen.getByText('Please select an Excel file (.xlsx or .xls)')).toBeInTheDocument();
      });
    });

    it('uploads Excel file successfully', async () => {
      const mockUploadResponse = {
        message: 'Excel upload processed successfully',
        summary: {
          totalRows: 2,
          validUpdates: 2,
          successfulUpdates: 2,
          errors: 0
        },
        updates: [
          {
            email: 'user1@example.com',
            accountNumber: 'LOAN-123',
            oldBalance: 10000,
            newBalance: 12000,
            change: 2000,
            userId: 1
          }
        ],
        errors: []
      };

      mockAdminApi.uploadExcel.mockResolvedValue(mockUploadResponse);

      // Mock window.alert
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      render(<ExcelUpload />);
      
      const fileInput = screen.getByRole('button', { name: /upload excel file/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      const validFile = new File(['mock excel content'], 'test.xlsx', { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      Object.defineProperty(fileInput, 'files', {
        value: [validFile],
        writable: false,
      });
      
      fireEvent.change(fileInput);
      
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Successfully updated 2 loan account(s)!');
        expect(screen.getByText('Upload Results')).toBeInTheDocument();
      });

      alertSpy.mockRestore();
    });

    it('handles upload error', async () => {
      mockAdminApi.uploadExcel.mockRejectedValue({
        response: {
          data: {
            error: 'Invalid Excel file format'
          }
        }
      });

      render(<ExcelUpload />);
      
      const fileInput = screen.getByRole('button', { name: /upload excel file/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      const validFile = new File(['mock excel content'], 'test.xlsx', { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      Object.defineProperty(fileInput, 'files', {
        value: [validFile],
        writable: false,
      });
      
      fireEvent.change(fileInput);
      
      await waitFor(() => {
        expect(screen.getByText('Invalid Excel file format')).toBeInTheDocument();
      });
    });
  });

  describe('Recent Updates', () => {
    it('displays recent updates from localStorage', () => {
      const mockRecentUpdates = [
        {
          email: 'user1@example.com',
          accountNumber: 'LOAN-123',
          oldBalance: 10000,
          newBalance: 12000,
          change: 2000,
          updatedAt: new Date().toISOString()
        }
      ];

      mockLocalStorage.setItem('excelUploadRecentUpdates', JSON.stringify(mockRecentUpdates));

      render(<ExcelUpload />);
      
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      expect(screen.getByText('LOAN-123')).toBeInTheDocument();
      expect(screen.getByText('$10,000.00')).toBeInTheDocument();
      expect(screen.getByText('$12,000.00')).toBeInTheDocument();
    });

    it('clears recent updates history', async () => {
      const mockRecentUpdates = [
        {
          email: 'user1@example.com',
          accountNumber: 'LOAN-123',
          oldBalance: 10000,
          newBalance: 12000,
          change: 2000,
          updatedAt: new Date().toISOString()
        }
      ];

      mockLocalStorage.setItem('excelUploadRecentUpdates', JSON.stringify(mockRecentUpdates));

      render(<ExcelUpload />);
      
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Clear History'));
      
      await waitFor(() => {
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('excelUploadRecentUpdates');
        expect(screen.getByText('No recent updates. Upload an Excel file to see updated loan accounts here.')).toBeInTheDocument();
      });
    });
  });

  describe('Callback Handling', () => {
    it('calls onUploadComplete callback after successful upload', async () => {
      const mockOnUploadComplete = jest.fn();
      const mockUploadResponse = {
        message: 'Excel upload processed successfully',
        summary: { totalRows: 1, successfulUpdates: 1, errors: 0 },
        updates: [],
        errors: []
      };

      mockAdminApi.uploadExcel.mockResolvedValue(mockUploadResponse);

      render(<ExcelUpload onUploadComplete={mockOnUploadComplete} />);
      
      const fileInput = screen.getByRole('button', { name: /upload excel file/i }).querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['mock excel content'], 'test.xlsx', { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      Object.defineProperty(fileInput, 'files', {
        value: [validFile],
        writable: false,
      });
      
      fireEvent.change(fileInput);
      
      await waitFor(() => {
        expect(mockOnUploadComplete).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<ExcelUpload />);
      
      expect(screen.getByRole('button', { name: /download template/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /upload excel file/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /instructions/i })).toBeInTheDocument();
    });
  });
});