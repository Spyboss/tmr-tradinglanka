import { Response, NextFunction } from 'express';
import { AuthRequest } from '../auth/auth.middleware.js';
import { AppError } from '../middleware/errorHandler.js';
import { resolveAbility } from '../permissions/index.js';
import * as warrantyClaimService from '../services/warrantyClaim.service.js';

/**
 * Thin controller: parse the request, resolve the caller's ability once,
 * delegate to the warranty claim service (which owns model access AND
 * authorization), respond. All scoping/permissions live in the service +
 * the permissions single source of truth.
 */

/** Preserves statusCode-bearing errors (AppError, CASL ForbiddenError=403);
 * wraps anything unexpected as 500 with the operation-specific message. */
const toAppError = (error: unknown, fallback: string): AppError =>
  error instanceof AppError || (error as { statusCode?: number })?.statusCode
    ? (error as AppError)
    : new AppError(`${fallback}: ${(error as Error).message}`, 500);

export const getAllWarrantyClaims = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ability = await resolveAbility(req);
    const result = await warrantyClaimService.listClaims(ability, req.query);
    res.status(200).json(result);
  } catch (error) {
    next(toAppError(error, 'Failed to fetch warranty claims'));
  }
};

export const getWarrantyClaimById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ability = await resolveAbility(req);
    const claim = await warrantyClaimService.getClaim(ability, req.params.id);
    res.status(200).json(claim);
  } catch (error) {
    next(toAppError(error, 'Failed to fetch warranty claim'));
  }
};

export const getPrefillData = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ability = await resolveAbility(req);
    const result = await warrantyClaimService.getPrefillData(ability, req.query);
    res.status(200).json(result);
  } catch (error) {
    next(toAppError(error, 'Failed to get prefill data'));
  }
};

export const searchBills = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ability = await resolveAbility(req);
    const bills = await warrantyClaimService.searchBillsForClaim(ability, req.query.q);
    res.status(200).json({ bills });
  } catch (error) {
    next(toAppError(error, 'Failed to search bills'));
  }
};

export const checkFormNumber = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await warrantyClaimService.checkFormNumberAvailable(
      req.query.number,
      req.query.excludeId
    );
    res.status(200).json(result);
  } catch (error) {
    next(toAppError(error, 'Failed to check form number'));
  }
};

export const suggestNextFormNumber = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await warrantyClaimService.suggestNextFormNumber();
    res.status(200).json(result);
  } catch (error) {
    next(toAppError(error, 'Failed to suggest form number'));
  }
};

export const createWarrantyClaim = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ability = await resolveAbility(req);
    const savedClaim = await warrantyClaimService.createClaim(
      ability,
      req.user?.id ?? '',
      req.body
    );
    res.status(201).json(savedClaim);
  } catch (error) {
    next(toAppError(error, 'Failed to create warranty claim'));
  }
};

export const updateWarrantyClaim = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ability = await resolveAbility(req);
    const updatedClaim = await warrantyClaimService.updateClaim(
      ability,
      req.params.id,
      req.body
    );
    res.status(200).json(updatedClaim);
  } catch (error) {
    next(toAppError(error, 'Failed to update warranty claim'));
  }
};

export const deleteWarrantyClaim = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ability = await resolveAbility(req);
    await warrantyClaimService.deleteClaim(ability, req.params.id);
    res.status(200).json({ message: 'Warranty claim deleted successfully' });
  } catch (error) {
    next(toAppError(error, 'Failed to delete warranty claim'));
  }
};

export const generateWarrantyClaimPDF = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ability = await resolveAbility(req);
    const { buffer, warrantyNumber } = await warrantyClaimService.getClaimPdf(ability, req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=TMR_Warranty_${warrantyNumber}.pdf`);
    res.send(buffer);
  } catch (error) {
    next(toAppError(error, 'Failed to generate PDF'));
  }
};
