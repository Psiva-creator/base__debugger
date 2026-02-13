import type { StepAnalysis } from 'chronovm-analyze';
import type { MemoryModel } from 'chronovm-model';
import type { ExplanationEvent } from 'chronovm-explain';

function resolvePrimitive(
    model: MemoryModel,
    address: string
): string | null {
    const node = model.heapNodes.find(n => n.address === address);
    if (!node) return null;
    if (node.kind === 'primitive') return String(node.value);
    return null;
}

function findVariableReferencing(
    model: MemoryModel,
    address: string
): string | null {
    for (const env of model.environments) {
        for (const binding of env.bindings) {
            if (binding.address === address) {
                return binding.name;
            }
        }
    }
    return null;
}

export function narrateStep(
    analysis: StepAnalysis
): readonly string[] {
    const sentences: string[] = [];
    const usedAddresses = new Set<string>();

    for (const event of analysis.events) {
        switch (event.type) {
            case 'ObjectAllocated': {
                const variable = findVariableReferencing(
                    analysis.memoryModel,
                    event.address
                );
                if (variable) {
                    sentences.push(
                        `A new object is created and stored in variable ${variable}.`
                    );
                    usedAddresses.add(event.address);
                } else {
                    sentences.push(`A new object is created.`);
                }
                break;
            }

            case 'VariableBound': {
                if (usedAddresses.has(event.address)) break;

                const value = resolvePrimitive(
                    analysis.memoryModel,
                    event.address
                );

                if (value !== null) {
                    sentences.push(
                        `The value ${value} is stored in variable ${event.name}.`
                    );
                } else {
                    sentences.push(
                        `A new object is stored in variable ${event.name}.`
                    );
                }
                break;
            }

            case 'VariableRebound': {
                const value = resolvePrimitive(
                    analysis.memoryModel,
                    event.to
                );

                if (value !== null) {
                    sentences.push(
                        `Variable ${event.name} is updated to ${value}.`
                    );
                } else {
                    sentences.push(
                        `Variable ${event.name} is updated.`
                    );
                }
                break;
            }

            case 'PropertyAdded': {
                const objectNode = analysis.memoryModel.heapNodes.find(
                    n => n.address === event.object && n.kind === 'object'
                );

                const variable = findVariableReferencing(
                    analysis.memoryModel,
                    event.object
                );

                if (objectNode && objectNode.kind === 'object') {
                    const prop = objectNode.properties.find(
                        p => p.key === event.property
                    );

                    if (prop) {
                        const value = resolvePrimitive(
                            analysis.memoryModel,
                            prop.address
                        );

                        if (variable && value !== null) {
                            sentences.push(
                                `The property '${event.property}' of ${variable} is set to ${value}.`
                            );
                            break;
                        }
                    }
                }

                if (variable) {
                    sentences.push(
                        `The property '${event.property}' of ${variable} is set.`
                    );
                } else {
                    sentences.push(
                        `The property '${event.property}' is added to the object.`
                    );
                }

                break;
            }

            case 'PropertyChanged': {
                sentences.push(
                    `The property '${event.property}' of the object is updated.`
                );
                break;
            }

            case 'ObjectCollected':
                sentences.push(
                    `An unused object is removed from memory.`
                );
                break;

            case 'ClosureCaptured':
                sentences.push(
                    `A function is created that remembers variables from its surrounding scope.`
                );
                break;

            case 'VariableUnbound':
                sentences.push(
                    `Variable ${event.name} is removed.`
                );
                break;

            case 'PropertyRemoved': {
                const variable = findVariableReferencing(
                    analysis.memoryModel,
                    event.object
                );

                if (variable) {
                    sentences.push(
                        `The property '${event.property}' of ${variable} is removed.`
                    );
                } else {
                    sentences.push(
                        `The property '${event.property}' is removed from the object.`
                    );
                }
                break;
            }

            case 'EnvironmentCreated':
                sentences.push(`A new scope is created.`);
                break;

            case 'EnvironmentDestroyed':
                sentences.push(`The current scope is exited.`);
                break;
        }
    }

    return sentences.sort();
}
