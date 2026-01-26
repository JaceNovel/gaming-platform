<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailTemplate;
use App\Services\AdminAuditLogger;
use Illuminate\Http\Request;

class AdminEmailTemplateController extends Controller
{
    public function index(Request $request)
    {
        $query = EmailTemplate::with('editor')->latest('id');

        if ($request->filled('key')) {
            $query->where('key', $request->query('key'));
        }

        if ($request->filled('active')) {
            $query->where('is_active', $request->boolean('active'));
        }

        $perPage = $request->integer('per_page', 30);

        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request, AdminAuditLogger $auditLogger)
    {
        $data = $request->validate([
            'key' => 'required|string|max:64|unique:email_templates,key',
            'name' => 'required|string|max:120',
            'subject' => 'required|string|max:200',
            'body' => 'required|string',
            'is_active' => 'sometimes|boolean',
        ]);

        $data['updated_by'] = $request->user()->id;
        $template = EmailTemplate::create($data);

        $auditLogger->log(
            $request->user(),
            'email_template_create',
            [
                'message' => 'Created email template',
                'template_id' => $template->id,
            ],
            actionType: 'email',
            request: $request
        );

        return response()->json(['data' => $template], 201);
    }

    public function update(Request $request, EmailTemplate $emailTemplate, AdminAuditLogger $auditLogger)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:120',
            'subject' => 'sometimes|string|max:200',
            'body' => 'sometimes|string',
            'is_active' => 'sometimes|boolean',
        ]);

        $data['updated_by'] = $request->user()->id;
        $emailTemplate->update($data);

        $auditLogger->log(
            $request->user(),
            'email_template_update',
            [
                'message' => 'Updated email template',
                'template_id' => $emailTemplate->id,
            ],
            actionType: 'email',
            request: $request
        );

        return response()->json(['data' => $emailTemplate]);
    }

    public function destroy(Request $request, EmailTemplate $emailTemplate, AdminAuditLogger $auditLogger)
    {
        $emailTemplate->delete();

        $auditLogger->log(
            $request->user(),
            'email_template_delete',
            [
                'message' => 'Deleted email template',
                'template_id' => $emailTemplate->id,
            ],
            actionType: 'email',
            request: $request
        );

        return response()->json(['message' => 'Template deleted']);
    }
}
