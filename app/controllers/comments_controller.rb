class CommentsController < ApplicationController
  before_action :set_comment, only: [:show]
  before_action :authenticate_user!, only: [:create]

  # GET /comments/:song_id
  def index
    @comments = Comment.where(song_id: params[:song_id])

    render json: @comments
  end

  # GET /comments/1
  def show
    render json: @comment
  end

  # POST /comments
  def create
    @comment = Comment.new(comment_params)

    if @comment.save
      render json: @comment, status: :created, location: @comment
    else
      render json: @comment.errors, status: :unprocessable_entity
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_comment
      @comment = Comment.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def comment_params
      params.require(:comment).permit(:user_id, :comment_id, :song_id, :body)
    end
end
