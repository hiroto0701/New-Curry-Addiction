<?php

namespace App\Models;

use App\Models\Prefecture;
use App\Models\ServiceUser;
use App\Traits\OperatorRecordable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;


class UserFavoritePrefecture extends Model
{
    use HasFactory;
    use OperatorRecordable;

    protected $table = 'user_favorite_prefectures';

    protected $fillable = [
        'user_id',
        'prefecture_id'
    ];

    protected $dates = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected $hidden = [
        'id',
        'user_id',
        'created_at',
        'updated_at',
        'deleted_at',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    // created_at, updated_atの更新はObserverで一括して行う
    public $timestamps = false;

    public function serviceUser(): BelongsTo
    {
        return $this->belongsTo(ServiceUser::class, 'user_id', 'user_id');
    }

    public function prefecture(): BelongsTo
    {
        return $this->belongsTo(Prefecture::class);
    }
}
