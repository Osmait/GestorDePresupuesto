package tasks

import (
	domain "github.com/osmait/gestorDePresupuesto/internal/domain/ai"
)

type Registry struct {
	tasks map[domain.AITaskType]domain.AITask
}

func NewRegistry() *Registry {
	return &Registry{
		tasks: make(map[domain.AITaskType]domain.AITask),
	}
}

func (r *Registry) Register(task domain.AITask) {
	r.tasks[task.GetType()] = task
}

func (r *Registry) Get(taskType domain.AITaskType) (domain.AITask, bool) {
	task, ok := r.tasks[taskType]
	return task, ok
}

func (r *Registry) GetAll() map[domain.AITaskType]domain.AITask {
	return r.tasks
}
