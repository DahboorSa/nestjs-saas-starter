import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { UserService } from '../users/user.service';

const mockOrganizationService = {
  getDetails: jest.fn(),
  updateName: jest.fn(),
};

const mockUserService = {
  findAll: jest.fn(),
  updateRole: jest.fn(),
  remove: jest.fn(),
};

const auditContext = { ipAddress: '127.0.0.1', userAgent: 'jest' } as any;
const userInfo = { userId: 'user-1', orgId: 'org-1' } as any;

const mockOrg = { id: 'org-1', name: 'Test Org', slug: 'test-org' };

describe('OrganizationController', () => {
  let controller: OrganizationController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationController],
      providers: [
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    controller = module.get<OrganizationController>(OrganizationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── GET /organizations/me ────────────────────────────────────────────────────

  describe('getOrganizations', () => {
    it('should return organization details', async () => {
      mockOrganizationService.getDetails.mockResolvedValue(mockOrg);

      const result = await controller.getOrganizations(userInfo);

      expect(result).toEqual(mockOrg);
      expect(mockOrganizationService.getDetails).toHaveBeenCalledWith(userInfo);
    });
  });

  // ─── GET /organizations/members ───────────────────────────────────────────────

  describe('getMembers', () => {
    it('should return all members of the organization', async () => {
      const members = [{ id: 'user-1', email: 'owner@example.com' }];
      mockUserService.findAll.mockResolvedValue(members);

      const result = await controller.getMembers(userInfo);

      expect(result).toEqual(members);
      expect(mockUserService.findAll).toHaveBeenCalledWith('org-1');
    });
  });

  // ─── PUT /organizations/me ────────────────────────────────────────────────────

  describe('updateOrganizations', () => {
    it('should update and return organization', async () => {
      const body = { name: 'New Name' } as any;
      const expected = { ...mockOrg, name: 'New Name', slug: 'new-name' };
      mockOrganizationService.updateName.mockResolvedValue(expected);

      const result = await controller.updateOrganizations(
        auditContext,
        userInfo,
        body,
      );

      expect(result).toEqual(expected);
      expect(mockOrganizationService.updateName).toHaveBeenCalledWith(
        auditContext,
        userInfo,
        body,
      );
    });
  });

  // ─── PUT /organizations/members/:userId/role ──────────────────────────────────

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const body = { role: 'ADMIN' } as any;
      const expected = { id: 'user-2', role: 'ADMIN' };
      mockUserService.updateRole.mockResolvedValue(expected);

      const result = await controller.updateMemberRole(
        auditContext,
        userInfo,
        'user-2',
        body,
      );

      expect(result).toEqual(expected);
      expect(mockUserService.updateRole).toHaveBeenCalledWith(
        auditContext,
        userInfo,
        {
          id: 'user-2',
          role: body.role,
        },
      );
    });
  });

  // ─── DELETE /organizations/members/:userId ────────────────────────────────────

  describe('removeMember', () => {
    it('should remove member and return result', async () => {
      const expected = { message: 'Member removed successfully' };
      mockUserService.remove.mockResolvedValue(expected);

      const result = await controller.removeMember(
        auditContext,
        userInfo,
        'user-2',
      );

      expect(result).toEqual(expected);
      expect(mockUserService.remove).toHaveBeenCalledWith(
        auditContext,
        userInfo,
        'user-2',
      );
    });
  });
});
