<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index(Request $request)
    {
        $query = Category::query()
            ->withCount(['products as products_count' => function ($builder) {
                $builder->where('is_active', true);
            }])
            ->orderBy('display_order')
            ->orderBy('name');

        if ($request->boolean('active_only', true)) {
            $query->where('is_active', true);
        }

        $categories = $query->get()->map(function (Category $category) {
            return [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
                'icon' => $category->icon,
                'description' => $category->description,
                'display_order' => $category->display_order,
                'products_count' => $category->products_count,
                'is_active' => $category->is_active,
            ];
        });

        return response()->json(['data' => $categories]);
    }

    public function show(string $category)
    {
        $item = Category::query()
            ->where('slug', $category)
            ->orWhere('id', $category)
            ->firstOrFail();

        $item->loadCount(['products as products_count' => function ($builder) {
            $builder->where('is_active', true);
        }]);

        return response()->json($item);
    }
}
