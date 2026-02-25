// ─────────────────────────────────────────────
// Project Controller
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import * as projectService from "./project.service";
import * as membershipService from "./membership.service";
import { logger } from "../../utils/logger";

export async function createProjectHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const { name, sourceCode, compilerVersion } = req.body;
        const project = await projectService.createProject(req.user!.id, {
            name,
            sourceCode,
            compilerVersion,
        });
        logger.info(`[PROJECT] Created id=${project.id} name=${JSON.stringify(name)} by=${req.user!.id}`);
        res.status(201).json(project);
    } catch (err) {
        next(err);
    }
}

export async function getProjectsHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const projects = await projectService.getUserProjects(req.user!.id);
        res.json(projects);
    } catch (err) {
        next(err);
    }
}

export async function getProjectHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const project = await projectService.getProject(
            req.params.id as string,
            req.membership!.role,
        );
        if (!project) {
            res.status(404).json({ error: { message: "Project not found" } });
            return;
        }
        res.json(project);
    } catch (err) {
        next(err);
    }
}

export async function addMemberHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const { email, role } = req.body;
        const member = await membershipService.addOrUpdateMember(
            req.params.id as string,
            req.user!.id,
            { email, role },
        );
        logger.info(`[ROLE_CHANGE] project=${req.params.id} email=${email} role=${role} by=${req.user!.id}`);
        res.status(201).json(member);
    } catch (err) {
        next(err);
    }
}

export async function getMembersHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const members = await membershipService.getMembers(req.params.id as string);
        res.json(members);
    } catch (err) {
        next(err);
    }
}
